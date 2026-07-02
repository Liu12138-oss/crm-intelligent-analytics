import { deflateRawSync } from 'node:zlib';
import { ContractReviewDocxExtractorService } from '../src/modules/contract-review/contract-review.docx-extractor.service';

function buildZipBuffer(entries: Array<{ fileName: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralDirectoryParts: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const fileNameBuffer = Buffer.from(entry.fileName, 'utf8');
    const contentBuffer = Buffer.from(entry.content, 'utf8');
    const compressedBuffer = deflateRawSync(contentBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(compressedBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileNameBuffer, compressedBuffer);

    const centralDirectoryHeader = Buffer.alloc(46);
    centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt16LE(0, 8);
    centralDirectoryHeader.writeUInt16LE(8, 10);
    centralDirectoryHeader.writeUInt32LE(compressedBuffer.length, 20);
    centralDirectoryHeader.writeUInt32LE(contentBuffer.length, 24);
    centralDirectoryHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralDirectoryHeader.writeUInt32LE(currentOffset, 42);

    centralDirectoryParts.push(centralDirectoryHeader, fileNameBuffer);
    currentOffset += localHeader.length + fileNameBuffer.length + compressedBuffer.length;
  }

  const centralDirectoryOffset = currentOffset;
  const centralDirectoryBuffer = Buffer.concat(centralDirectoryParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryBuffer.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([...localParts, centralDirectoryBuffer, endOfCentralDirectory]);
}

describe('ContractReviewDocxExtractorService', () => {
  it('应从最小 docx 结构中提取标题、段落和条款摘要', () => {
    const service = new ContractReviewDocxExtractorService();
    const documentXml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>采购合作协议</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>第一条 合作范围</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>知识产权归乙方所有，甲方仅在约定范围内享有使用权。</w:t></w:r></w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>付款安排</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>验收通过后五个工作日内支付合同款项。</w:t></w:r></w:p>',
      '</w:body>',
      '</w:document>',
    ].join('');
    const buffer = buildZipBuffer([
      { fileName: '[Content_Types].xml', content: '<Types></Types>' },
      { fileName: 'word/document.xml', content: documentXml },
    ]);

    const snapshot = service.extract(buffer);

    expect(snapshot.title).toBe('采购合作协议');
    expect(snapshot.paragraphs).toHaveLength(5);
    expect(snapshot.headings).toHaveLength(2);
    expect(snapshot.clauses).toHaveLength(1);
    expect(snapshot.clauses[0].locator).toBe('正文条款1');
    expect(snapshot.summary).toContain('5 个段落');
  });

  it('缺少 document.xml 时应拒绝继续审核', () => {
    const service = new ContractReviewDocxExtractorService();
    const buffer = buildZipBuffer([{ fileName: '[Content_Types].xml', content: '<Types></Types>' }]);

    expect(() => service.extract(buffer)).toThrow('当前 .docx 文件缺少正文内容，无法继续审核。');
  });
});
