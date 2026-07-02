import { deflateRawSync } from 'node:zlib';
import { ContractReviewAnnotatedDocxService } from '../src/modules/contract-review/contract-review.annotated-docx.service';
import { ContractReviewDocxExtractorService } from '../src/modules/contract-review/contract-review.docx-extractor.service';
import type { ContractReviewIssueRecord } from '../src/shared/types/domain';

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

describe('ContractReviewAnnotatedDocxService', () => {
  it('应在原始 docx 中追加系统审核批注区', () => {
    const annotatedDocxService = new ContractReviewAnnotatedDocxService();
    const extractorService = new ContractReviewDocxExtractorService();
    const documentXml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>采购合作协议</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>知识产权及源代码成果归甲方独占所有。</w:t></w:r></w:p>',
      '<w:sectPr></w:sectPr>',
      '</w:body>',
      '</w:document>',
    ].join('');
    const sourceDocx = buildZipBuffer([
      { fileName: '[Content_Types].xml', content: '<Types></Types>' },
      { fileName: 'word/document.xml', content: documentXml },
    ]);
    const issues: ContractReviewIssueRecord[] = [
      {
        id: 'issue_1',
        taskId: 'task_1',
        title: '知识产权或源代码归客户独有',
        riskLevel: 'HIGH',
        isVeto: true,
        description: '合同把成果权利归给甲方。',
        suggestion: '改为乙方享有知识产权，甲方仅享有使用权。',
        quote: '正文段落1：知识产权及源代码成果归甲方独占所有。',
        ruleCode: 'CR-IP-001',
        ruleTitle: '知识产权或源代码归客户独有',
        sourceClause: '一票否决项#1 / 2.7 知识产权',
        createdAt: '2026-04-06T00:00:00.000Z',
      },
    ];

    const annotatedDocx = annotatedDocxService.buildAnnotatedDocx(sourceDocx, issues);
    const snapshot = extractorService.extract(annotatedDocx);
    const fullText = snapshot.paragraphs.map((fragment) => fragment.text).join('\n');

    expect(annotatedDocx.length).toBeGreaterThan(sourceDocx.length);
    expect(fullText).toContain('系统审核批注');
    expect(fullText).toContain('知识产权或源代码归客户独有');
    expect(fullText).toContain('改为乙方享有知识产权');
  });
});
