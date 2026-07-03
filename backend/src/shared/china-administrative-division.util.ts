export interface ChinaProvinceCityKeyword {
  province: string;
  keywords: string[];
}

export const UNKNOWN_CITY_LABEL = '未识别地市';

export const CHINA_PROVINCE_CITY_KEYWORDS: ChinaProvinceCityKeyword[] = [
  { province: '北京', keywords: ['北京'] },
  { province: '天津', keywords: ['天津'] },
  { province: '上海', keywords: ['上海'] },
  { province: '重庆', keywords: ['重庆'] },
  { province: '河北', keywords: ['河北', '石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'] },
  { province: '山西', keywords: ['山西', '太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'] },
  { province: '内蒙古', keywords: ['内蒙古', '呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布'] },
  { province: '辽宁', keywords: ['辽宁', '沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'] },
  { province: '吉林', keywords: ['吉林', '长春', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'] },
  { province: '黑龙江', keywords: ['黑龙江', '哈尔滨', '齐齐哈尔', '牡丹江', '佳木斯', '大庆', '鸡西', '双鸭山', '伊春', '七台河', '鹤岗', '黑河', '绥化'] },
  { province: '江苏', keywords: ['江苏', '南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'] },
  { province: '浙江', keywords: ['浙江', '杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'] },
  { province: '安徽', keywords: ['安徽', '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'] },
  { province: '福建', keywords: ['福建', '福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'] },
  { province: '江西', keywords: ['江西', '南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'] },
  { province: '山东', keywords: ['山东', '济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'] },
  { province: '河南', keywords: ['河南', '郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店', '济源'] },
  { province: '湖北', keywords: ['湖北', '武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施'] },
  { province: '湖南', keywords: ['湖南', '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'] },
  { province: '广东', keywords: ['广东', '广州', '深圳', '珠海', '汕头', '佛山', '韶关', '湛江', '肇庆', '江门', '茂名', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'] },
  { province: '广西', keywords: ['广西', '南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'] },
  { province: '海南', keywords: ['海南', '海口', '三亚', '三沙', '儋州'] },
  { province: '四川', keywords: ['四川', '成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳', '阿坝', '甘孜', '凉山'] },
  { province: '贵州', keywords: ['贵州', '贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'] },
  { province: '云南', keywords: ['云南', '昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆'] },
  { province: '西藏', keywords: ['西藏', '拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里'] },
  { province: '陕西', keywords: ['陕西', '西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'] },
  { province: '甘肃', keywords: ['甘肃', '兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南', '临夏', '甘南'] },
  { province: '青海', keywords: ['青海', '西宁', '海东', '海北', '黄南', '海南藏族自治州', '果洛', '玉树', '海西'] },
  { province: '宁夏', keywords: ['宁夏', '银川', '石嘴山', '吴忠', '固原', '中卫'] },
  { province: '新疆', keywords: ['新疆', '乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '博尔塔拉', '巴音郭楞', '阿克苏', '克孜勒苏', '喀什', '和田', '伊犁', '塔城', '阿勒泰'] },
];

export const MAINLAND_CHINA_PROVINCE_NAMES = CHINA_PROVINCE_CITY_KEYWORDS.map((item) => item.province);

const MUNICIPALITY_NAMES = new Set(['北京', '天津', '上海', '重庆']);

export const CHINA_PROVINCE_CITY_NAMES: Record<string, string[]> = Object.fromEntries(
  CHINA_PROVINCE_CITY_KEYWORDS.map((item) => [
    item.province,
    MUNICIPALITY_NAMES.has(item.province)
      ? [item.province]
      : item.keywords.filter((keyword) => keyword !== item.province),
  ]),
);

export const CHINA_PREFECTURE_CITY_TOTAL = Object.values(CHINA_PROVINCE_CITY_NAMES)
  .reduce((sum, cityNames) => sum + cityNames.length, 0);

function normalizeAdministrativeText(text: string): string {
  return text.replace(/\s/gu, '');
}

export function resolveChinaProvinceByText(text: string): string {
  const normalizedText = normalizeAdministrativeText(text);
  if (!normalizedText) {
    return '';
  }

  let matchedProvince = '';
  let matchedKeywordLength = 0;
  for (const item of CHINA_PROVINCE_CITY_KEYWORDS) {
    for (const keyword of item.keywords) {
      if (normalizedText.includes(keyword) && keyword.length > matchedKeywordLength) {
        matchedProvince = item.province;
        matchedKeywordLength = keyword.length;
      }
    }
  }

  return matchedProvince;
}

export function resolveChinaCityByText(text: string, province: string): string | null {
  const normalizedText = normalizeAdministrativeText(text);
  if (!normalizedText) {
    return null;
  }

  const cityNames = CHINA_PROVINCE_CITY_NAMES[province] ?? [];
  return cityNames.find((cityName) => normalizedText.includes(cityName)) ?? null;
}
