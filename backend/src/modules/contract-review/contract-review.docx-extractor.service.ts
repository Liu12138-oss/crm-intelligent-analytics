import { BadRequestException, Injectable } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';
import type {
  ContractReviewDocumentFragment,
  ContractReviewDocumentSnapshot,
} from './contract-review.types';

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

interface ZipEntry {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

@Injectable()
export class ContractReviewDocxExtractorService {
  extract(buffer: Buffer): ContractReviewDocumentSnapshot {
    const archiveEntries = this.readArchiveEntries(buffer);
    const documentEntry = archiveEntries.find((entry) => entry.fileName === 'word/document.xml');
    if (!documentEntry) {
      throw new BadRequestException('当前 .docx 文件缺少正文内容，无法继续审核。');
    }

    const orderedEntries = [
      documentEntry,
      ...archiveEntries
        .filter((entry) => /^word\/header\d+\.xml$/i.test(entry.fileName))
        .sort((left, right) => left.fileName.localeCompare(right.fileName)),
      ...archiveEntries
        .filter((entry) => /^word\/footer\d+\.xml$/i.test(entry.fileName))
        .sort((left, right) => left.fileName.localeCompare(right.fileName)),
    ];

    const paragraphs: ContractReviewDocumentFragment[] = [];
    const headings: ContractReviewDocumentFragment[] = [];
    const clauses: ContractReviewDocumentFragment[] = [];

    let fragmentIndex = 1;
    for (const entry of orderedEntries) {
      const xml = this.readEntryText(buffer, entry);
      const source = entry.fileName.includes('/header')
        ? 'header'
        : entry.fileName.includes('/footer')
          ? 'footer'
          : 'document';
      const extracted = this.extractParagraphsFromXml(xml, source, fragmentIndex);
      fragmentIndex += extracted.length;
      paragraphs.push(...extracted);
      headings.push(...extracted.filter((fragment) => this.isHeadingFragment(fragment)));
      clauses.push(...extracted.filter((fragment) => this.isClauseFragment(fragment.text)));
    }

    if (paragraphs.length === 0) {
      throw new BadRequestException('当前 .docx 文件未提取到可审核正文，请检查文件是否损坏。');
    }

    const fullText = paragraphs.map((fragment) => fragment.text).join('\n');
    if (fullText.trim().length < 20) {
      throw new BadRequestException('当前 .docx 文件正文内容过少，无法形成可信审核结果。');
    }

    const title =
      headings[0]?.text ??
      paragraphs.find((fragment) => fragment.source === 'document')?.text ??
      '未命名合同';

    return {
      title,
      summary: this.buildDocumentSummary(title, paragraphs, headings, clauses),
      fullText,
      paragraphs,
      headings,
      clauses,
    };
  }

  /**
   * 这里手工解析 ZIP 中央目录，避免当前阶段为 `.docx` 提取额外引入第三方压缩依赖。
   * 一期只需要读取 Word XML 文本，因此最小支持「存储」与「deflate」两种常见压缩方式即可。
   */
  private readArchiveEntries(buffer: Buffer): ZipEntry[] {
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

    const entries: ZipEntry[] = [];
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

  private readEntryText(buffer: Buffer, entry: ZipEntry): string {
    if (buffer.readUInt32LE(entry.localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
      throw new BadRequestException('当前 .docx 文件结构损坏，无法读取正文内容。');
    }

    const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
    const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
    const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
    const compressedData = buffer.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === 0) {
      return compressedData.toString('utf8');
    }

    if (entry.compressionMethod === 8) {
      return inflateRawSync(compressedData).toString('utf8');
    }

    throw new BadRequestException('当前 .docx 使用了暂不支持的压缩方式。');
  }

  private extractParagraphsFromXml(
    xml: string,
    source: ContractReviewDocumentFragment['source'],
    startIndex: number,
  ): ContractReviewDocumentFragment[] {
    const paragraphs: ContractReviewDocumentFragment[] = [];
    const paragraphMatches = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];

    let paragraphCount = 0;
    let headingCount = 0;
    let clauseCount = 0;

    for (const paragraphXml of paragraphMatches) {
      const text = this.extractParagraphText(paragraphXml);
      if (!text) {
        continue;
      }

      paragraphCount += 1;
      const style = this.extractParagraphStyle(paragraphXml);
      const isHeading = Boolean(style && /^(title|heading\d*)$/i.test(style));
      const isClause = this.isClauseFragment(text);

      if (isHeading) {
        headingCount += 1;
      }

      if (isClause) {
        clauseCount += 1;
      }

      paragraphs.push({
        index: startIndex + paragraphs.length,
        text,
        style,
        source,
        locator: this.buildLocator(source, {
          paragraphCount,
          headingCount,
          clauseCount,
          isHeading,
          isClause,
        }),
      });
    }

    return paragraphs;
  }

  private extractParagraphText(paragraphXml: string): string {
    const normalizedXml = paragraphXml
      .replace(/<w:tab\s*\/>/g, ' ')
      .replace(/<w:br\s*\/>/g, '\n')
      .replace(/<w:cr\s*\/>/g, '\n');
    const textMatches = normalizedXml.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g) ?? [];
    const text = textMatches
      .map((match) => {
        const content = match.replace(/^<w:t\b[^>]*>/, '').replace(/<\/w:t>$/, '');
        return this.decodeXmlEntities(content);
      })
      .join('');

    return text.replace(/\s+/g, ' ').trim();
  }

  private extractParagraphStyle(paragraphXml: string): string | undefined {
    const matched = paragraphXml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
    return matched?.[1];
  }

  private isHeadingFragment(fragment: ContractReviewDocumentFragment): boolean {
    return Boolean(fragment.style && /^(title|heading\d*)$/i.test(fragment.style));
  }

  private isClauseFragment(text: string): boolean {
    return /^(第[一二三四五六七八九十百零\d]+条|[一二三四五六七八九十]+、|\d+(\.\d+)+|\d+\.)/.test(
      text,
    );
  }

  private buildLocator(
    source: ContractReviewDocumentFragment['source'],
    counters: {
      paragraphCount: number;
      headingCount: number;
      clauseCount: number;
      isHeading: boolean;
      isClause: boolean;
    },
  ): string {
    const sourceLabel =
      source === 'header' ? '页眉' : source === 'footer' ? '页脚' : '正文';

    if (counters.isHeading) {
      return `${sourceLabel}标题${counters.headingCount}`;
    }

    if (counters.isClause) {
      return `${sourceLabel}条款${counters.clauseCount}`;
    }

    return `${sourceLabel}段落${counters.paragraphCount}`;
  }

  private buildDocumentSummary(
    title: string,
    paragraphs: ContractReviewDocumentFragment[],
    headings: ContractReviewDocumentFragment[],
    clauses: ContractReviewDocumentFragment[],
  ): string {
    return `已提取《${title}》正文，共识别 ${paragraphs.length} 个段落、${headings.length} 个标题、${clauses.length} 个疑似条款，当前可进入规则审核阶段。`;
  }

  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&#x([0-9a-fA-F]+);/g, (_, value: string) =>
        String.fromCodePoint(Number.parseInt(value, 16)),
      )
      .replace(/&#(\d+);/g, (_, value: string) =>
        String.fromCodePoint(Number.parseInt(value, 10)),
      )
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}
