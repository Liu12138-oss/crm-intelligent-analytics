import { Injectable } from '@nestjs/common';
import type {
  AiExecutableProfile,
  AiProviderAdapter,
  AiProviderHealthCheckResult,
  AiProviderStructuredInvokeParams,
  AiProviderTextInvokeParams,
} from './ai-provider.adapter';
import type { AiStructuredOutputMode, AiWireApi } from '../../../shared/types/domain';

type JsonSchema = Record<string, unknown>;

interface HttpInvokeOptions {
  wireApi: AiWireApi;
  structuredOutputMode: AiStructuredOutputMode;
  disableResponseStorage: boolean;
  enableThinking?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * 使用服务端 HTTP 直接调用 OpenAI 兼容模型网关。
 *
 * 该 adapter 不依赖本地 Agent CLI、SDK thread、MCP 或工具执行能力；
 * 业务上下文必须由上层服务显式传入 prompt。
 */
@Injectable()
export class OpenAiCompatibleHttpAdapter implements AiProviderAdapter {
  readonly sdkType = 'openai-compatible-http' as const;

  /**
   * 校验 HTTP Profile 的最小必填字段，避免请求阶段才暴露明显误配。
   */
  validateProfile(profile: AiExecutableProfile): void {
    if (!profile.baseUrl?.trim()) {
      throw new Error('OpenAI 兼容 HTTP Profile 缺少 baseUrl。');
    }
    if (!profile.model.trim()) {
      throw new Error('OpenAI 兼容 HTTP Profile 缺少 model。');
    }
    if (!profile.secretConfigured || !profile.apiKey?.trim()) {
      throw new Error('OpenAI 兼容 HTTP Profile 缺少 API 密钥。');
    }
  }

  /**
   * 通过一次最小结构化调用验证服务地址、鉴权、模型名、协议类型与结构化输出链路。
   *
   * 设计原因：
   * 1. 智能分析和企业微信入口主链优先依赖结构化调用，而不是纯文本调用；
   * 2. 仅测试纯文本会出现“健康检查成功，但 capability pack 结构化执行失败”的误导；
   * 3. 用最小 schema 做连通性验证，可以更贴近真实问数入口而不泄露业务提示词。
   */
  async healthCheck(profile: AiExecutableProfile): Promise<AiProviderHealthCheckResult> {
    const startedAt = Date.now();
    try {
      this.validateProfile(profile);
      await this.invokeStructured({
        profile,
        system: '你是 CRM 智能分析系统的结构化连通性检查器。',
        prompt: '请返回 {"status":"OK"}',
        outputSchema: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: {
              type: 'string',
              enum: ['OK'],
            },
          },
        },
      });

      return {
        status: 'SUCCEEDED',
        latencyMs: Date.now() - startedAt,
        providerSummary: `${profile.providerCode}:${profile.model}`,
      };
    } catch (error) {
      return {
        status: 'FAILED',
        latencyMs: Date.now() - startedAt,
        failureStage: this.resolveFailureStage(error),
        failureReason: this.sanitizeErrorMessage(error, profile.apiKey),
        providerSummary: `${profile.providerCode}:${profile.model}`,
      };
    }
  }

  /**
   * 执行纯文本模型调用，并从当前协议响应中提取最终文本。
   */
  async invokeText(params: AiProviderTextInvokeParams): Promise<string> {
    const profile = params.profile;
    this.validateProfile(profile);
    const options = this.resolveOptions(profile, params.requestOverrides);

    if (options.wireApi === 'responses') {
      const response = await this.postJson(
        profile,
        'responses',
        {
          model: profile.model,
          input: params.prompt,
          ...(params.system?.trim() ? { instructions: params.system.trim() } : {}),
          ...(options.disableResponseStorage ? { store: false } : {}),
        },
        options,
      );
      return this.extractFinalText(response);
    }

    if (options.wireApi === 'chat_completions') {
      const response = await this.postJson(
        profile,
        'chat/completions',
        {
          model: profile.model,
          messages: this.buildMessages(params.system, params.prompt),
          max_tokens: this.resolveMaxTokens(profile, options),
          ...this.buildProviderSpecificChatCompletionOptions(profile, options),
        },
        options,
      );
      return this.extractFinalText(response);
    }

    throw new Error(`不支持的 OpenAI 兼容 HTTP 协议：${String(options.wireApi)}`);
  }

  /**
   * 执行结构化模型调用，并对返回 JSON 做本地 schema 校验。
   */
  async invokeStructured(
    params: AiProviderStructuredInvokeParams,
  ): Promise<unknown> {
    const profile = params.profile;
    this.validateProfile(profile);
    const options = this.resolveOptions(profile, params.requestOverrides);

    if (options.wireApi === 'responses') {
      const response = await this.postJson(
        profile,
        'responses',
        {
          model: profile.model,
          input: params.prompt,
          ...(params.system?.trim() ? { instructions: params.system.trim() } : {}),
          ...(options.disableResponseStorage ? { store: false } : {}),
          text: {
            format: this.buildJsonSchemaFormat(params.outputSchema),
          },
        },
        options,
      );
      return this.parseAndValidateStructured(response, params.outputSchema);
    }

    if (options.wireApi === 'chat_completions') {
      const systemPrompt = this.buildStructuredSystemPrompt(
        params.system,
        params.outputSchema,
        options.structuredOutputMode,
      );
      const requestBody: Record<string, unknown> = {
        model: profile.model,
        messages: this.buildMessages(systemPrompt, params.prompt),
        max_tokens: this.resolveStructuredMaxTokens(profile, options),
        ...this.buildProviderSpecificChatCompletionOptions(profile, options),
      };

      if (options.structuredOutputMode === 'json_schema') {
        requestBody.response_format = {
          type: 'json_schema',
          json_schema: this.buildJsonSchemaFormat(params.outputSchema),
        };
      } else if (options.structuredOutputMode === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await this.postJson(
        profile,
        'chat/completions',
        requestBody,
        options,
      );
      return this.parseAndValidateStructured(response, params.outputSchema);
    }

    throw new Error(`不支持的 OpenAI 兼容 HTTP 协议：${String(options.wireApi)}`);
  }

  /**
   * 统一解析协议、结构化输出模式和响应落盘开关。
   */
  private resolveOptions(
    profile: AiExecutableProfile,
    requestOverrides?: AiProviderTextInvokeParams['requestOverrides'],
  ): HttpInvokeOptions {
    this.assertAllowedRequestOverrides(requestOverrides);
    const sdkOptions = profile.sdkOptions ?? {};
    const rawWireApi =
      typeof requestOverrides?.wireApi === 'string'
        ? requestOverrides.wireApi.trim()
        : typeof sdkOptions.wireApi === 'string'
          ? sdkOptions.wireApi.trim()
          : 'responses';
    const wireApi = this.normalizeWireApi(rawWireApi);
    const rawStructuredMode =
      typeof requestOverrides?.structuredOutputMode === 'string'
        ? requestOverrides.structuredOutputMode.trim()
        : typeof sdkOptions.structuredOutputMode === 'string'
          ? sdkOptions.structuredOutputMode.trim()
          : undefined;
    const structuredOutputMode = this.normalizeStructuredOutputMode(
      rawStructuredMode,
      wireApi,
    );

    return {
      wireApi,
      structuredOutputMode,
      disableResponseStorage:
        typeof requestOverrides?.disableResponseStorage === 'boolean'
          ? requestOverrides.disableResponseStorage
          : sdkOptions.disableResponseStorage !== false,
      enableThinking:
        typeof requestOverrides?.enableThinking === 'boolean'
          ? requestOverrides.enableThinking
          : undefined,
      maxTokens:
        typeof requestOverrides?.maxTokens === 'number'
          ? requestOverrides.maxTokens
          : undefined,
      timeoutMs:
        typeof requestOverrides?.timeoutMs === 'number'
          ? requestOverrides.timeoutMs
          : undefined,
    };
  }

  /**
   * capability pack 只允许透传白名单中的覆盖项，避免业务层退化成任意请求体拼装。
   */
  private assertAllowedRequestOverrides(
    requestOverrides?: AiProviderTextInvokeParams['requestOverrides'],
  ): void {
    if (!requestOverrides) {
      return;
    }

    const allowedKeys = new Set([
      'wireApi',
      'structuredOutputMode',
      'disableResponseStorage',
      'enableThinking',
      'maxTokens',
      'timeoutMs',
    ]);
    const unknownKey = Object.keys(requestOverrides).find(
      (key) => !allowedKeys.has(key),
    );
    if (unknownKey) {
      throw new Error(`不支持的 capability request override 字段：${unknownKey}`);
    }
  }

  /**
   * 只允许受控协议值，避免治理表单变成任意 HTTP 客户端。
   */
  private normalizeWireApi(value: string): AiWireApi {
    if (value === 'responses' || value === 'chat_completions') {
      return value;
    }

    throw new Error(`不支持的 OpenAI 兼容 HTTP 协议：${value}`);
  }

  /**
   * 根据协议补齐结构化输出默认模式。
   */
  private normalizeStructuredOutputMode(
    value: string | undefined,
    wireApi: AiWireApi,
  ): AiStructuredOutputMode {
    if (
      value === 'json_schema' ||
      value === 'json_object' ||
      value === 'prompt_schema'
    ) {
      return value;
    }

    return wireApi === 'chat_completions' ? 'json_object' : 'json_schema';
  }

  /**
   * 发起 JSON POST 请求，并集中处理超时、HTTP 状态和响应 JSON 解析。
   */
  private async postJson(
    profile: AiExecutableProfile,
    path: 'responses' | 'chat/completions',
    body: Record<string, unknown>,
    options?: Pick<HttpInvokeOptions, 'timeoutMs'>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, options?.timeoutMs ?? profile.timeoutMs ?? 60000);

    try {
      const response = await fetch(this.buildUrl(profile.baseUrl ?? '', path), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${profile.apiKey ?? ''}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        throw this.buildHttpStatusError(response.status, responseText, profile.apiKey);
      }

      try {
        return await response.json();
      } catch {
        const error = new Error('模型服务响应不是合法 JSON。');
        error.name = 'RESPONSE_PARSE';
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error('模型服务请求超时。');
        timeoutError.name = 'HTTP_REQUEST';
        throw timeoutError;
      }

      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * 兼容管理员填写带或不带尾随斜杠的 Base URL。
   */
  private buildUrl(baseUrl: string, path: string): string {
    return `${baseUrl.replace(/\/+$/u, '')}/${path}`;
  }

  /**
   * 从 Responses 或 Chat Completions 响应中提取最终文本。
   */
  private extractFinalText(response: unknown): string {
    if (!response || typeof response !== 'object') {
      throw this.buildResponseParseError('模型响应为空。', response);
    }

    const responseRecord = response as Record<string, unknown>;
    if (typeof responseRecord.output_text === 'string') {
      return responseRecord.output_text;
    }

    const outputText = this.extractResponsesOutputText(responseRecord.output);
    if (outputText) {
      return outputText;
    }

    const choiceText = this.extractChatChoiceText(responseRecord.choices);
    if (choiceText) {
      return choiceText;
    }

    const anthropicStyleText = this.extractAnthropicMessageText(responseRecord.content);
    if (anthropicStyleText) {
      return anthropicStyleText;
    }

    const directText = this.extractDirectResponseText(responseRecord);
    if (directText) {
      return directText;
    }

    throw this.buildResponseParseError('模型响应缺少最终文本。', response);
  }

  /**
   * 解析结构化文本并执行本地 JSON Schema 校验。
   */
  private parseAndValidateStructured(
    response: unknown,
    outputSchema: JsonSchema,
  ): unknown {
    const finalText = this.extractFinalText(response);
    try {
      const parsedJson = this.parseJsonObject(finalText);
      this.validateJsonSchema(parsedJson, outputSchema, '');
      return parsedJson;
    } catch (error) {
      if (error instanceof Error) {
        this.attachStructuredDebugPreview(error, finalText);
      }
      throw error;
    }
  }

  /**
   * Responses 可能把最终文本放在 output.content[].text / output_text 等字段中。
   */
  private extractResponsesOutputText(output: unknown): string | undefined {
    if (!Array.isArray(output)) {
      return undefined;
    }

    const textParts: string[] = [];
    for (const outputItem of output) {
      if (!outputItem || typeof outputItem !== 'object') {
        continue;
      }

      const content = (outputItem as Record<string, unknown>).content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const contentItem of content) {
        const text = this.extractTextFromContentItem(contentItem);
        if (text) {
          textParts.push(text);
        }
      }
    }

    return textParts.join('').trim() || undefined;
  }

  /**
   * Chat Completions 以 choices[0].message.content 返回文本。
   */
  private extractChatChoiceText(choices: unknown): string | undefined {
    if (!Array.isArray(choices)) {
      return undefined;
    }

    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== 'object') {
      return undefined;
    }

    const choiceRecord = firstChoice as Record<string, unknown>;
    if (typeof choiceRecord.text === 'string' && choiceRecord.text.trim()) {
      return choiceRecord.text;
    }

    const message = (firstChoice as Record<string, unknown>).message;
    if (!message || typeof message !== 'object') {
      return undefined;
    }

    const messageRecord = message as Record<string, unknown>;
    const content = messageRecord.content;
    const contentText = this.extractMessageContentText(content);
    if (contentText) {
      return contentText;
    }

    const structuredPayloadText = this.extractStructuredPayloadText(messageRecord);
    if (structuredPayloadText) {
      return structuredPayloadText;
    }

    const toolCallText = this.extractToolCallArgumentsText(messageRecord.tool_calls);
    if (toolCallText) {
      return toolCallText;
    }

    const functionCallText = this.extractFunctionCallArgumentsText(
      messageRecord.function_call,
    );
    if (functionCallText) {
      return functionCallText;
    }

    if (typeof messageRecord.reasoning_content === 'string') {
      return this.extractJsonCandidateText(messageRecord.reasoning_content);
    }

    return undefined;
  }

  /**
   * 解析 Chat Completions message.content 中的文本。
   *
   * 参数说明：`content` 为兼容网关返回的消息正文，可能是字符串或内容块数组。
   * 返回值说明：提取到非空文本时返回字符串，否则返回 `undefined`。
   * 调用注意事项：该函数只处理最终正文，不读取工具调用参数。
   */
  private extractMessageContentText(content: unknown): string | undefined {
    if (typeof content === 'string') {
      return content.trim() || undefined;
    }

    if (!Array.isArray(content)) {
      return undefined;
    }

    const textParts = content
      .map((item) => this.extractTextFromContentItem(item))
      .filter((item): item is string => Boolean(item));
    return textParts.join('').trim() || undefined;
  }

  /**
   * 某些兼容网关会返回 Anthropic message 风格的 `content[].text`。
   */
  private extractAnthropicMessageText(content: unknown): string | undefined {
    if (!Array.isArray(content)) {
      return undefined;
    }

    const textParts = content
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => item.text)
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

    return textParts.join('').trim() || undefined;
  }

  /**
   * 兼容部分网关把结构化结果放在 message.parsed / json / arguments 中的返回。
   *
   * 参数说明：`record` 为 Chat Completions 的 message 对象。
   * 返回值说明：命中结构化 payload 时返回可继续 JSON.parse 的文本。
   * 设计原因：有些 OpenAI 兼容网关不会填充 message.content，但会把 JSON 放在扩展字段中；
   * 读取这些字段仍属于模型结构化输出主链，不会恢复本地关键词兜底。
   */
  private extractStructuredPayloadText(record: Record<string, unknown>): string | undefined {
    for (const key of ['parsed', 'json', 'arguments']) {
      const text = this.stringifyStructuredPayload(record[key]);
      if (text) {
        return text;
      }
    }

    return undefined;
  }

  /**
   * 兼容函数工具调用形态中的结构化参数。
   *
   * 参数说明：`toolCalls` 为 Chat Completions 返回的 `tool_calls` 数组。
   * 返回值说明：找到首个非空 `function.arguments` 时返回其 JSON 文本。
   * 调用注意事项：这里只读取模型已经给出的结构化参数，不发起任何工具执行。
   */
  private extractToolCallArgumentsText(toolCalls: unknown): string | undefined {
    if (!Array.isArray(toolCalls)) {
      return undefined;
    }

    for (const toolCall of toolCalls) {
      if (!toolCall || typeof toolCall !== 'object') {
        continue;
      }

      const functionPayload = (toolCall as Record<string, unknown>).function;
      const text = this.extractFunctionCallArgumentsText(functionPayload);
      if (text) {
        return text;
      }
    }

    return undefined;
  }

  /**
   * 兼容旧版 function_call.arguments 结构。
   *
   * 参数说明：`functionCall` 为 Chat Completions message 中的函数调用对象。
   * 返回值说明：命中字符串或对象形态的 arguments 时返回 JSON 文本。
   * 调用注意事项：返回值后续仍会经过本地 JSON Schema 校验。
   */
  private extractFunctionCallArgumentsText(functionCall: unknown): string | undefined {
    if (!functionCall || typeof functionCall !== 'object') {
      return undefined;
    }

    return this.stringifyStructuredPayload(
      (functionCall as Record<string, unknown>).arguments,
    );
  }

  /**
   * 将结构化 payload 转成可解析文本。
   *
   * 参数说明：`value` 为兼容网关返回的字符串、对象或数组。
   * 返回值说明：字符串原样返回，普通对象和数组序列化为 JSON 文本，其它类型返回 `undefined`。
   * 调用注意事项：空字符串不作为有效结构化输出，避免把空 content 误判为成功。
   */
  private stringifyStructuredPayload(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value.trim() || undefined;
    }

    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }

    return undefined;
  }

  /**
   * 兼容把 JSON 包在 reasoning_content 中的少数网关异常返回。
   *
   * 参数说明：`value` 为模型推理字段文本。
   * 返回值说明：仅当文本里存在平衡 JSON 对象或数组时返回 JSON 片段。
   * 设计原因：reasoning_content 通常不是最终回答，只有在 content 缺失且其中明确包含 JSON 时才读取，
   * 避免把推理过程当成正式业务意图。
   */
  private extractJsonCandidateText(value: string): string | undefined {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return undefined;
    }

    const fencedJsonContent = this.extractMarkdownJsonBlock(normalizedValue);
    if (fencedJsonContent) {
      return fencedJsonContent;
    }

    return this.extractBalancedJsonCandidate(normalizedValue);
  }

  /**
   * 兼容少量网关在顶层 text / result / message 字段返回最终文本。
   *
   * 参数说明：`responseRecord` 为模型 HTTP JSON 响应对象。
   * 返回值说明：命中最终文本或结构化对象时返回文本。
   * 调用注意事项：该逻辑排在标准 Responses、Chat Completions、Anthropic 形态之后，
   * 只作为协议兼容，不改变上层能力包的本地 schema 校验。
   */
  private extractDirectResponseText(
    responseRecord: Record<string, unknown>,
  ): string | undefined {
    for (const key of ['text', 'result']) {
      const text = this.stringifyStructuredPayload(responseRecord[key]);
      if (text) {
        return text;
      }
    }

    const message = responseRecord.message;
    if (typeof message === 'string') {
      return message.trim() || undefined;
    }

    if (message && typeof message === 'object') {
      const messageRecord = message as Record<string, unknown>;
      return (
        this.extractMessageContentText(messageRecord.content) ??
        this.extractStructuredPayloadText(messageRecord)
      );
    }

    return undefined;
  }

  /**
   * 从兼容网关常见的内容块中提取文本。
   *
   * 参数说明：`contentItem` 为 Responses、Chat Completions 或第三方兼容网关返回的内容块。
   * 返回值说明：命中文本时返回字符串，否则返回 undefined。
   * 调用注意事项：这里只读取文本字段，不解释 tool call，避免把工具参数误当最终回答。
   */
  private extractTextFromContentItem(contentItem: unknown): string | undefined {
    if (typeof contentItem === 'string') {
      return contentItem.trim() || undefined;
    }

    if (!contentItem || typeof contentItem !== 'object') {
      return undefined;
    }

    const record = contentItem as Record<string, unknown>;
    for (const key of ['text', 'output_text', 'content']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }

      if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>;
        const nestedText = nested.value ?? nested.text;
        if (typeof nestedText === 'string' && nestedText.trim()) {
          return nestedText;
        }
      }
    }

    return undefined;
  }

  /**
   * 去除常见 Markdown 代码块包装后解析 JSON。
   */
  private parseJsonObject(finalText: string): unknown {
    const normalizedText = finalText.trim();
    const fencedJsonContent = this.extractMarkdownJsonBlock(normalizedText);
    const directCandidate = fencedJsonContent ?? normalizedText;

    try {
      return JSON.parse(directCandidate) as unknown;
    } catch {
      const extractedCandidate = this.extractBalancedJsonCandidate(directCandidate);
      if (extractedCandidate) {
        try {
          return JSON.parse(extractedCandidate) as unknown;
        } catch {
          // 忽略二次解析异常，统一抛出结构化解析失败。
        }
      }

      const error = new Error('模型结构化输出不是合法 JSON。');
      error.name = 'RESPONSE_PARSE';
      throw error;
    }
  }

  /**
   * 结构化解析失败时保留原始文本片段，便于业务侧把失败现场落盘排查。
   */
  private attachStructuredDebugPreview(error: Error, finalText: string): void {
    const normalizedText = finalText.trim();
    const rawResponsePreview =
      normalizedText.length > 4000
        ? `${normalizedText.slice(0, 4000).trim()}\n...[truncated]`
        : normalizedText;

    Object.assign(error, {
      rawResponseText: normalizedText,
      rawResponsePreview,
      rawResponseLength: normalizedText.length,
    });
  }

  /**
   * 兼容模型把 JSON 包在 Markdown 代码块中的返回。
   */
  private extractMarkdownJsonBlock(finalText: string): string | undefined {
    const matchedBlock = finalText.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
    return matchedBlock?.[1]?.trim() || undefined;
  }

  /**
   * 兼容“说明文字 + JSON 正文 + 尾部说明”的包装输出，仅提取首个平衡 JSON 对象或数组。
   */
  private extractBalancedJsonCandidate(finalText: string): string | undefined {
    const startIndex = finalText.search(/[[{]/u);
    if (startIndex < 0) {
      return undefined;
    }

    const openingChar = finalText[startIndex];
    const closingChar = openingChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < finalText.length; index += 1) {
      const currentChar = finalText[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (currentChar === '\\') {
        escaped = true;
        continue;
      }

      if (currentChar === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (currentChar === openingChar) {
        depth += 1;
        continue;
      }

      if (currentChar === closingChar) {
        depth -= 1;
        if (depth === 0) {
          return finalText.slice(startIndex, index + 1).trim();
        }
      }
    }

    return undefined;
  }

  /**
   * 构造 OpenAI 兼容 JSON Schema response_format。
   */
  private buildJsonSchemaFormat(outputSchema: JsonSchema): Record<string, unknown> {
    return {
      type: 'json_schema',
      name: 'crm_structured_output',
      schema: outputSchema,
      strict: true,
    };
  }

  /**
   * 构造 Chat Completions 消息列表。
   */
  private buildMessages(system: string | undefined, prompt: string): Array<{
    role: 'system' | 'user';
    content: string;
  }> {
    return [
      ...(system?.trim()
        ? [{ role: 'system' as const, content: system.trim() }]
        : []),
      {
        role: 'user',
        content: prompt,
      },
    ];
  }

  /**
   * 为特定 Provider 补齐非标准但必需的 Chat Completions 参数。
   *
   * 当前已知约束：
   * 1. DashScope 的 Qwen3 在非流式调用中要求显式传 `enable_thinking=false`；
   * 2. 若管理员已在 sdkOptions 中显式配置该值，则以显式配置为准；
   * 3. 仅对 Qwen3 默认补齐，避免把 Provider 私有参数误发给其它模型。
   */
  private buildProviderSpecificChatCompletionOptions(
    profile: AiExecutableProfile,
    options?: Pick<HttpInvokeOptions, 'enableThinking'>,
  ): Record<string, unknown> {
    if (typeof options?.enableThinking === 'boolean') {
      return {
        enable_thinking: options.enableThinking,
      };
    }

    const explicitEnableThinking = this.readBooleanSdkOption(
      profile.sdkOptions,
      'enableThinking',
      'enable_thinking',
    );
    if (typeof explicitEnableThinking === 'boolean') {
      return {
        enable_thinking: explicitEnableThinking,
      };
    }

    if (!this.shouldDisableQwenThinkingByDefault(profile)) {
      return {};
    }

    return {
      enable_thinking: false,
    };
  }

  /**
   * Qwen3 非流式调用默认关闭 thinking，避免 DashScope 直接拒绝请求。
   */
  private shouldDisableQwenThinkingByDefault(
    profile: AiExecutableProfile,
  ): boolean {
    const providerCode = profile.providerCode.trim().toLowerCase();
    const platformPreset =
      typeof profile.sdkOptions.platformPreset === 'string'
        ? profile.sdkOptions.platformPreset.trim().toLowerCase()
        : '';
    const normalizedModel = profile.model.trim().toLowerCase();

    const isQwenProfile =
      providerCode === 'qwen' || platformPreset === 'qwen';
    const isQwen3Model = /^qwen3(?:$|-)/u.test(normalizedModel);

    return isQwenProfile && isQwen3Model;
  }

  /**
   * 读取布尔型 sdkOptions，兼容 camelCase 与 snake_case 两种写法。
   */
  private readBooleanSdkOption(
    sdkOptions: Record<string, unknown>,
    ...keys: string[]
  ): boolean | undefined {
    for (const key of keys) {
      if (typeof sdkOptions[key] === 'boolean') {
        return sdkOptions[key] as boolean;
      }
    }

    return undefined;
  }

  /**
   * 兼容 Anthropic 风格的 OpenAI endpoint，请求里补齐 `max_tokens`。
   */
  private resolveMaxTokens(
    profile: AiExecutableProfile,
    options?: Pick<HttpInvokeOptions, 'maxTokens'>,
  ): number {
    if (typeof options?.maxTokens === 'number' && options.maxTokens > 0) {
      return Math.floor(options.maxTokens);
    }

    const configuredMaxTokens = Number(
      typeof profile.sdkOptions.maxTokens === 'number'
        ? profile.sdkOptions.maxTokens
        : typeof profile.sdkOptions.max_tokens === 'number'
          ? profile.sdkOptions.max_tokens
          : NaN,
    );
    if (Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0) {
      return Math.floor(configuredMaxTokens);
    }

    return 256;
  }

  /**
   * 结构化调用默认需要更高的输出上限，避免长 JSON 在 provider 侧被截断。
   *
   * 参数说明：
   * - `profile`：当前执行的 AI Profile。
   * - `options`：本次请求的覆盖项，显式传了 `maxTokens` 时优先使用显式值。
   * 返回值：结构化调用可用的 `max_tokens`。
   */
  private resolveStructuredMaxTokens(
    profile: AiExecutableProfile,
    options?: Pick<HttpInvokeOptions, 'maxTokens'>,
  ): number {
    const resolvedMaxTokens = this.resolveMaxTokens(profile, options);
    return resolvedMaxTokens >= 1024 ? resolvedMaxTokens : 1024;
  }

  /**
   * 将调用方 JSON Schema 转成中文字段约束，用于 json_object / prompt_schema 模式。
   */
  private buildStructuredSystemPrompt(
    system: string | undefined,
    outputSchema: JsonSchema,
    structuredOutputMode: AiStructuredOutputMode,
  ): string | undefined {
    if (structuredOutputMode === 'json_schema') {
      return system?.trim() || undefined;
    }

    const schemaPrompt = [
      '你必须只返回 JSON，不得返回 Markdown、解释文字或代码块。',
      '返回 JSON 必须满足以下结构约束：',
      ...this.describeJsonSchema(outputSchema, '$'),
    ].join('\n');

    return system?.trim() ? `${system.trim()}\n\n${schemaPrompt}` : schemaPrompt;
  }

  /**
   * 递归描述 JSON Schema 中的字段类型、必填项与枚举范围。
   */
  private describeJsonSchema(schema: JsonSchema, path: string): string[] {
    const lines: string[] = [];
    const type = this.resolveSchemaType(schema);
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === 'string')
      : [];

    lines.push(`- ${path}: 类型 ${type ?? '未声明'}`);

    if (Array.isArray(schema.enum)) {
      lines.push(`  可选值：${schema.enum.map((item) => String(item)).join('、')}`);
    }

    if (type === 'object' && schema.properties && typeof schema.properties === 'object') {
      for (const [key, childSchema] of Object.entries(
        schema.properties as Record<string, JsonSchema>,
      )) {
        lines.push(`  字段 ${key}${required.includes(key) ? '（必填）' : '（可选）'}`);
        lines.push(...this.describeJsonSchema(childSchema, `${path}.${key}`));
      }
    }

    if (type === 'array' && schema.items && typeof schema.items === 'object') {
      lines.push(...this.describeJsonSchema(schema.items as JsonSchema, `${path}[]`));
    }

    return lines;
  }

  /**
   * 对模型输出执行必要的本地 JSON Schema 校验。
   */
  private validateJsonSchema(value: unknown, schema: JsonSchema, path: string): void {
    const schemaType = this.resolveSchemaType(schema);
    const displayPath = path || '$';

    if (!this.matchesSchemaType(value, schemaType)) {
      throw this.buildSchemaValidationError(
        `结构化输出字段类型不匹配：${displayPath}`,
      );
    }

    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      throw this.buildSchemaValidationError(
        `结构化输出字段枚举值不合法：${displayPath}`,
      );
    }

    if (
      schemaType === 'object' &&
      schema.properties &&
      typeof schema.properties === 'object'
    ) {
      const valueRecord = value as Record<string, unknown>;
      const required = Array.isArray(schema.required)
        ? schema.required.filter((item): item is string => typeof item === 'string')
        : [];
      for (const requiredKey of required) {
        if (!(requiredKey in valueRecord)) {
          throw this.buildSchemaValidationError(
            `结构化输出缺少必填字段：${displayPath}.${requiredKey}`,
          );
        }
      }

      const propertySchemas = schema.properties as Record<string, JsonSchema>;
      for (const [key, childSchema] of Object.entries(propertySchemas)) {
        if (key in valueRecord) {
          this.validateJsonSchema(valueRecord[key], childSchema, `${displayPath}.${key}`);
        }
      }

      if (schema.additionalProperties === false) {
        const allowedKeys = new Set(Object.keys(propertySchemas));
        const extraKey = Object.keys(valueRecord).find((key) => !allowedKeys.has(key));
        if (extraKey) {
          throw this.buildSchemaValidationError(
            `结构化输出包含未声明字段：${displayPath}.${extraKey}`,
          );
        }
      }
    }

    if (schemaType === 'array' && schema.items && typeof schema.items === 'object') {
      (value as unknown[]).forEach((item, index) => {
        this.validateJsonSchema(item, schema.items as JsonSchema, `${displayPath}[${index}]`);
      });
    }
  }

  /**
   * 解析 JSON Schema type，兼容 nullable 写法中的数组类型。
   */
  private resolveSchemaType(schema: JsonSchema): string | undefined {
    if (typeof schema.type === 'string') {
      return schema.type;
    }
    if (Array.isArray(schema.type)) {
      return schema.type.find((item) => item !== 'null');
    }

    return undefined;
  }

  /**
   * 判断值是否匹配当前 JSON Schema 基础类型。
   */
  private matchesSchemaType(value: unknown, schemaType: string | undefined): boolean {
    if (!schemaType) {
      return true;
    }

    if (schemaType === 'object') {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }
    if (schemaType === 'array') {
      return Array.isArray(value);
    }
    if (schemaType === 'integer') {
      return Number.isInteger(value);
    }
    if (schemaType === 'number') {
      return typeof value === 'number' && Number.isFinite(value);
    }
    if (schemaType === 'string') {
      return typeof value === 'string';
    }
    if (schemaType === 'boolean') {
      return typeof value === 'boolean';
    }

    return true;
  }

  /**
   * 生成带阶段标识的 schema 校验错误。
   */
  private buildSchemaValidationError(message: string): Error {
    const error = new Error(message);
    error.name = 'SCHEMA_VALIDATION';
    return error;
  }

  /**
   * 生成带阶段标识的响应解析错误。
   */
  private buildResponseParseError(message: string, response?: unknown): Error {
    const error = new Error(message);
    error.name = 'RESPONSE_PARSE';
    this.attachRawResponseDebugPreview(error, response);
    return error;
  }

  /**
   * 响应解析失败时保留截断后的原始响应，便于从业务日志定位兼容网关返回形态。
   *
   * 参数说明：
   * - `error`：即将抛出的解析错误对象；
   * - `response`：模型服务返回的 JSON 响应或空响应。
   * 返回值说明：无返回值，调试片段会挂在错误对象上。
   * 调用注意事项：这里只保存响应体片段，不包含请求头或 API Key；长度受控，避免日志过大。
   */
  private attachRawResponseDebugPreview(error: Error, response: unknown): void {
    const normalizedResponse = this.stringifyRawResponseForDebug(response);
    if (!normalizedResponse) {
      return;
    }

    const rawResponsePreview =
      normalizedResponse.length > 4000
        ? `${normalizedResponse.slice(0, 4000).trim()}\n...[truncated]`
        : normalizedResponse;

    Object.assign(error, {
      rawResponseText: normalizedResponse,
      rawResponsePreview,
      rawResponseLength: normalizedResponse.length,
    });
  }

  /**
   * 将未知响应安全转成调试文本。
   *
   * 参数说明：`response` 为模型 HTTP 响应体。
   * 返回值说明：成功序列化时返回字符串；空值或无法表达的值返回 `undefined`。
   * 调用注意事项：循环引用对象按 `String(value)` 兜底，避免调试信息本身再次抛错。
   */
  private stringifyRawResponseForDebug(response: unknown): string | undefined {
    if (response === undefined || response === null) {
      return undefined;
    }

    if (typeof response === 'string') {
      return response.trim() || undefined;
    }

    try {
      const serializedResponse = JSON.stringify(response);
      return serializedResponse.trim() || undefined;
    } catch {
      const fallbackText = String(response).trim();
      return fallbackText || undefined;
    }
  }

  /**
   * 生成脱敏后的 HTTP 状态错误。
   */
  private buildHttpStatusError(
    status: number,
    responseText: string,
    apiKey?: string,
  ): Error {
    const sanitizedText = this.sanitizeText(responseText, apiKey).slice(0, 240);
    const error = new Error(
      `模型服务返回非成功状态：${status}${sanitizedText ? `，${sanitizedText}` : ''}`,
    );
    error.name = 'HTTP_STATUS';
    return error;
  }

  /**
   * 根据错误名称归类健康检查失败阶段。
   */
  private resolveFailureStage(error: unknown): AiProviderHealthCheckResult['failureStage'] {
    if (!(error instanceof Error)) {
      return 'HTTP_REQUEST';
    }
    if (error.name === 'HTTP_STATUS') {
      return 'HTTP_STATUS';
    }
    if (error.name === 'RESPONSE_PARSE') {
      return 'RESPONSE_PARSE';
    }
    if (error.name === 'SCHEMA_VALIDATION') {
      return 'SCHEMA_VALIDATION';
    }
    if (error.message.includes('缺少')) {
      return 'STATIC_VALIDATION';
    }

    return 'HTTP_REQUEST';
  }

  /**
   * 错误摘要必须脱敏，避免密钥进入日志、审计或接口响应。
   */
  private sanitizeErrorMessage(error: unknown, apiKey?: string): string {
    if (error instanceof Error) {
      return this.sanitizeText(error.message, apiKey);
    }

    return 'unknown';
  }

  /**
   * 对密钥和 Authorization 片段做最小脱敏。
   */
  private sanitizeText(value: string, apiKey?: string): string {
    let sanitizedValue = value;
    if (apiKey?.trim()) {
      sanitizedValue = sanitizedValue.split(apiKey.trim()).join('[已脱敏]');
    }

    return sanitizedValue.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gu, 'Bearer [已脱敏]');
  }
}
