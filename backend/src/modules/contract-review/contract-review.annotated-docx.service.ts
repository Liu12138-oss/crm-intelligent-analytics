import { BadRequestException, Injectable } from '@nestjs/common';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { ContractReviewIssueRecord } from '../../shared/types/domain';

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CRC32_POLYNOMIAL = 0xedb88320;

interface ZipEntryIndex {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

interface WritableZipEntry {
  fileName: string;
  data: Buffer;
}

@Injectable()
export class ContractReviewAnnotatedDocxService {
  private readonly crc32Table = this.buildCrc32Table();

  buildAnnotatedDocx(sourceBuffer: Buffer, issues: ContractReviewIssueRecord[]): Buffer {
    const entries = this.readArchiveEntries(sourceBuffer);
    const writableEntries = entries
      .filter((entry) => !entry.fileName.endsWith('/'))
      .map((entry) => ({
        fileName: entry.fileName,
        data: this.readEntryBuffer(sourceBuffer, entry),
      }));

    const documentEntry = writableEntries.find((entry) => entry.fileName === 'word/document.xml');
    if (!documentEntry) {
      throw new BadRequestException('当前 .docx 文件缺少正文内容，无法生成批注稿。');
    }

    const documentXml = documentEntry.data.toString('utf8');
    documentEntry.data = Buffer.from(this.injectReviewSection(documentXml, issues), 'utf8');

    return this.writeArchive(writableEntries);
  }

  private readArchiveEntries(buffer: Buffer): ZipEntryIndex[] {
    const endOfCentralDirectoryOffset = this.findEndOfCentralDirectoryOffset(buffer);
    const centralDirectorySize = buffer.readUInt32LE(endOfCentralDirectoryOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

    if (
      centralDirectoryOffset < 0 ||
      centralDirectorySize <= 0 ||
      centralDirectoryEnd > buffer.length
    ) {
      throw new BadRequestException('上传文件不是有效的 .docx 压缩包。');
    }

    const entries: ZipEntryIndex[] = [];
    let offset = centralDirectoryOffset;
    while (offset < centralDirectoryEnd) {
      if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
        throw new BadRequestException('当前文件不是可解析的标准 .docx 压缩包。');
      }

      const compressionMethod = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const fileNameLength = buffer.readUInt16LE(offset + 28);
      const extraFieldLength = buffer.readUInt16LE(offset + 30);
      const fileCommentLength = buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = buffer.readUInt32LE(offset + 42);
      const fileNameStart = offset + 46;
      const fileNameEnd = fileNameStart + fileNameLength;

      entries.push({
        fileName: buffer.toString('utf8', fileNameStart, fileNameEnd),
        compressionMethod,
        compressedSize,
        localHeaderOffset,
      });

      offset = fileNameEnd + extraFieldLength + fileCommentLength;
    }

    return entries;
  }

  private findEndOfCentralDirectoryOffset(buffer: Buffer): number {
    if (buffer.length < 22) {
      throw new BadRequestException('上传文件不是有效的 .docx 压缩包。');
    }

    const minimumOffset = Math.max(0, buffer.length - 0xffff - 22);
    for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
      if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
        return offset;
      }
    }

    throw new BadRequestException('上传文件不是有效的 .docx 压缩包。');
  }

  private readEntryBuffer(buffer: Buffer, entry: ZipEntryIndex): Buffer {
    if (buffer.readUInt32LE(entry.localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
      throw new BadRequestException('当前 .docx 文件结构损坏，无法生成批注稿。');
    }

    const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
    const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
    const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
    const compressedData = buffer.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === 0) {
      return Buffer.from(compressedData);
    }

    if (entry.compressionMethod === 8) {
      return inflateRawSync(compressedData);
    }

    throw new BadRequestException('当前 .docx 使用了暂不支持的压缩方式。');
  }

  private injectReviewSection(documentXml: string, issues: ContractReviewIssueRecord[]): string {
    const reviewSection = this.buildReviewSectionXml(issues);

    if (documentXml.includes('<w:sectPr')) {
      return documentXml.replace(/<w:sectPr\b/, `${reviewSection}<w:sectPr`);
    }

    if (documentXml.includes('</w:body>')) {
      return documentXml.replace('</w:body>', `${reviewSection}</w:body>`);
    }

    throw new BadRequestException('当前 .docx 正文结构异常，无法插入审核批注。');
  }

  private buildReviewSectionXml(issues: ContractReviewIssueRecord[]): string {
    const paragraphs = [
      this.buildHeadingParagraph('系统审核批注'),
      this.buildNormalParagraph('以下内容由系统根据合同审核结果自动补充，仅供商务与法务复核。'),
    ];

    if (issues.length === 0) {
      paragraphs.push(this.buildNormalParagraph('本次审核未命中风险问题，可结合审核报告继续人工复核。'));
      return paragraphs.join('');
    }

    for (const [index, issue] of issues.entries()) {
      paragraphs.push(this.buildHeadingParagraph(`${index + 1}. ${issue.title}`, 'Heading2'));
      paragraphs.push(
        this.buildNormalParagraph(
          `风险等级：${issue.isVeto ? '一票否决 / 高风险' : issue.riskLevel}`,
        ),
      );
      paragraphs.push(this.buildNormalParagraph(`命中位置：${issue.quote}`));
      paragraphs.push(this.buildNormalParagraph(`问题说明：${issue.description}`));
      paragraphs.push(this.buildNormalParagraph(`修改建议：${issue.suggestion}`));
      paragraphs.push(this.buildNormalParagraph(`规则依据：${issue.sourceClause}`));
    }

    return paragraphs.join('');
  }

  private buildHeadingParagraph(content: string, style = 'Heading1'): string {
    return [
      '<w:p>',
      `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`,
      `<w:r><w:t>${this.escapeXml(content)}</w:t></w:r>`,
      '</w:p>',
    ].join('');
  }

  private buildNormalParagraph(content: string): string {
    return `<w:p><w:r><w:t>${this.escapeXml(content)}</w:t></w:r></w:p>`;
  }

  private escapeXml(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private writeArchive(entries: WritableZipEntry[]): Buffer {
    const localParts: Buffer[] = [];
    const centralDirectoryParts: Buffer[] = [];
    let currentOffset = 0;

    for (const entry of entries) {
      const fileNameBuffer = Buffer.from(entry.fileName, 'utf8');
      const compressedBuffer = entry.data.length > 0 ? deflateRawSync(entry.data) : Buffer.alloc(0);
      const compressionMethod = entry.data.length > 0 ? 8 : 0;
      const crc32 = this.computeCrc32(entry.data);

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER_SIGNATURE, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(compressionMethod, 8);
      localHeader.writeUInt32LE(crc32, 14);
      localHeader.writeUInt32LE(compressedBuffer.length, 18);
      localHeader.writeUInt32LE(entry.data.length, 22);
      localHeader.writeUInt16LE(fileNameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, fileNameBuffer, compressedBuffer);

      const centralDirectoryHeader = Buffer.alloc(46);
      centralDirectoryHeader.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_SIGNATURE, 0);
      centralDirectoryHeader.writeUInt16LE(20, 4);
      centralDirectoryHeader.writeUInt16LE(20, 6);
      centralDirectoryHeader.writeUInt16LE(0, 8);
      centralDirectoryHeader.writeUInt16LE(compressionMethod, 10);
      centralDirectoryHeader.writeUInt32LE(crc32, 16);
      centralDirectoryHeader.writeUInt32LE(compressedBuffer.length, 20);
      centralDirectoryHeader.writeUInt32LE(entry.data.length, 24);
      centralDirectoryHeader.writeUInt16LE(fileNameBuffer.length, 28);
      centralDirectoryHeader.writeUInt16LE(0, 30);
      centralDirectoryHeader.writeUInt16LE(0, 32);
      centralDirectoryHeader.writeUInt16LE(0, 34);
      centralDirectoryHeader.writeUInt16LE(0, 36);
      centralDirectoryHeader.writeUInt32LE(0, 38);
      centralDirectoryHeader.writeUInt32LE(currentOffset, 42);

      centralDirectoryParts.push(centralDirectoryHeader, fileNameBuffer);
      currentOffset += localHeader.length + fileNameBuffer.length + compressedBuffer.length;
    }

    const centralDirectoryOffset = currentOffset;
    const centralDirectoryBuffer = Buffer.concat(centralDirectoryParts);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
    endOfCentralDirectory.writeUInt16LE(entries.length, 8);
    endOfCentralDirectory.writeUInt16LE(entries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectoryBuffer.length, 12);
    endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

    return Buffer.concat([...localParts, centralDirectoryBuffer, endOfCentralDirectory]);
  }

  private buildCrc32Table(): number[] {
    const table: number[] = [];
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value =
          (value & 1) === 1 ? (value >>> 1) ^ CRC32_POLYNOMIAL : value >>> 1;
      }
      table[index] = value >>> 0;
    }

    return table;
  }

  private computeCrc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const value of buffer) {
      crc = (crc >>> 8) ^ this.crc32Table[(crc ^ value) & 0xff];
    }

    return (crc ^ 0xffffffff) >>> 0;
  }
}
