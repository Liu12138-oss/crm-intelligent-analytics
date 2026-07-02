export type FormFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | FormFieldValue[]
  | { [key: string]: FormFieldValue };

// 递归展开嵌套对象和数组，统一输出为 CRM Open API 可接受的 x-www-form-urlencoded 结构。
export function appendUrlEncodedFormField(
  formData: URLSearchParams,
  fieldPath: string,
  value: FormFieldValue,
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendUrlEncodedFormField(formData, `${fieldPath}[${index}]`, item);
    });
    return;
  }

  if (typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendUrlEncodedFormField(
        formData,
        `${fieldPath}[${childKey}]`,
        childValue,
      );
    }
    return;
  }

  formData.append(fieldPath, String(value));
}
