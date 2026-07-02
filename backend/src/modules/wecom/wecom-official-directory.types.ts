export interface WecomOfficialTokenResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
}

export interface WecomOfficialDepartmentItem {
  id: number;
  name: string;
  name_en?: string;
  parentid: number;
  order?: number;
  department_leader?: string[];
}

export interface WecomOfficialDepartmentListResponse {
  errcode: number;
  errmsg: string;
  department?: WecomOfficialDepartmentItem[];
}

export interface WecomOfficialSimpleDepartmentItem {
  id: number;
  parentid?: number;
  order?: number;
}

export interface WecomOfficialDepartmentSimpleListResponse {
  errcode: number;
  errmsg: string;
  department_id?: WecomOfficialSimpleDepartmentItem[];
}

export interface WecomOfficialUserListItem {
  userid: string;
  name: string;
  department: number[];
  order?: number[];
  position?: string;
  mobile?: string;
  gender?: string;
  email?: string;
  telephone?: string;
  alias?: string;
  status?: number;
  address?: string;
  english_name?: string;
  main_department?: number;
  direct_leader?: string[];
  avatar?: string;
  extattr?: Record<string, unknown>;
}

export interface WecomOfficialUserListResponse {
  errcode: number;
  errmsg: string;
  userlist?: WecomOfficialUserListItem[];
}

export interface WecomOfficialUserGetResponse extends WecomOfficialUserListItem {
  errcode: number;
  errmsg: string;
  avatar?: string;
  thumb_avatar?: string;
}
