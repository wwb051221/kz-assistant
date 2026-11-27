/* ============================================================
   i18n.js — 中 / 英 / 俄 文案 + 单位换算
   ============================================================ */
(function () {
  'use strict';

  var D = {
    zh: {
      /* 设置面板 */
      settings: '设置', themeL: '仪表风格', modelL: '3D 机模', sensorL: '画面', thrustL: '单发推力', thrustU: '推力', tAuto: '按机型自动', tManual: '手动',
      calibL: '姿态校准', filterL: '态势过滤', fAir: '飞机/导弹', fGnd: '地面', fSur: '水面', dispL: '显示', layoutL: '布局', unitsL: '单位', langL: '语言', uiL: '界面',
      done: '完成', autosave: '设置会自动保存',
      tWide: '俄系/中式大屏', tF15: '美系 F-15', tPfd: '战斗机 PFD', tClassic: '经典六表', tGlass: '玻璃座舱',
      sTgp: '红外', sWhot: '白热', sBhot: '黑热', sOff: '可见光',
      flipP: '翻转俯仰', flipR: '翻转坡度', fpmBtn: '航迹面板', scaleBtn: '坡度尺',
      lAuto: '自动', lLr: '左右', lTb: '上下', lMfd: '仅仪表', l3d: '仅 3D',
      uMetric: '公制', uImp: '英制',
      uiDark: '深色', uiLight: '浅色',
      modelLocal: '本地文件…', modelBuiltin: '内置机模', mScope: '姿态球', mModel: '3D 模型', mAxes: '坐标系', resetView: '复位视角', resetModel: '重置模型', dragHint: '拖动旋转 · 滚轮缩放 · 双击复位',

      /* MFD */
      att: '姿态', calc: '计算', energy: '能量', tactical: '态势', noContacts: '无敌情', legend: '图例', heading: '朝向', measuring: '测量中', kMsl: '导弹', kAir: '飞机', kGnd: '地面', kSur: '水面', es: '比能量 H+V²/2g', ps: '剩余功率', turnR: '转弯率', speedTotal: '速度 X/Y/Z', radius: '转弯半径', thrust: '推力', accel: '加速度', endur: '续航', range: '航程', eng: '发动机', nav: '导航', data: '飞行数据',
      ias: '空速', alt: '高度', pitch: '俯仰', bank: '坡度', aoa: '迎角', g: '过载',
      mach: '马赫', vs: '垂直速度', trk: '航迹', fuel: '剩余燃油', aos: '侧滑',
      hdg: '磁航向', thr: '油门', oil: '油温', eng1: '左发', eng2: '右发', single: '单发',
      lamp_gear: '起落架', lamp_flaps: '襟翼', lamp_brake: '减速板', lamp_wep: '加力', lamp_fuel: '燃油', lamp_ovspd: '超速', lamp_stall: '失速', lamp_link: '链接',
      gear: '起落架', engLeft: '左发', engRight: '右发', nose: '机头', spd: '速度', vel: '矢量'
    },
    en: {
      settings: 'SETTINGS', themeL: 'LAYOUT', modelL: '3D MODEL', sensorL: 'SENSOR', thrustL: 'ENGINE THRUST', thrustU: 'Thrust', tAuto: 'Auto by type', tManual: 'Manual',
      calibL: 'ATTITUDE', filterL: 'CONTACT FILTER', fAir: 'Air/Msl', fGnd: 'Ground', fSur: 'Surface', dispL: 'DISPLAY', layoutL: 'PANEL LAYOUT', unitsL: 'UNITS', langL: 'LANGUAGE', uiL: 'THEME',
      done: 'DONE', autosave: 'Settings are saved automatically',
      tWide: 'RUS/CN WIDE', tF15: 'F-15 MFD', tPfd: 'F-16 PFD', tClassic: 'CLASSIC', tGlass: 'GLASS',
      sTgp: 'IR', sWhot: 'WHOT', sBhot: 'BHOT', sOff: 'EO',
      flipP: 'Flip pitch', flipR: 'Flip bank', fpmBtn: 'Flight path', scaleBtn: 'Bank scale',
      lAuto: 'Auto', lLr: 'Side by side', lTb: 'Stacked', lMfd: 'MFD only', l3d: '3D only',
      uMetric: 'Metric', uImp: 'Imperial',
      uiDark: 'Dark', uiLight: 'Light',
      modelLocal: 'Local file…', modelBuiltin: 'Built-in', mScope: 'Attitude ball', mModel: '3D model', mAxes: 'Coord frame', resetView: 'Reset view', resetModel: 'Reset model', dragHint: 'Drag to orbit · wheel to zoom · dbl-click to reset',

      att: 'ATTITUDE', calc: 'CALC', energy: 'ENERGY', tactical: 'CONTACTS', noContacts: 'NO CONTACTS', legend: 'LEGEND', heading: 'HEADING', measuring: 'MEASURING', kMsl: 'MISSILE', kAir: 'AIRCRAFT', kGnd: 'GROUND', kSur: 'SURFACE', es: 'SPEC ENERGY H+V²/2g', ps: 'EXCESS POWER', turnR: 'SPEED X/Y/Z', radius: 'TURN RADIUS', thrust: 'THRUST', accel: 'ACCEL', endur: 'ENDURANCE', range: 'RANGE', eng: 'ENGINE', nav: 'NAV', data: 'FLIGHT DATA',
      ias: 'IAS', alt: 'ALT', pitch: 'PITCH', bank: 'BANK', aoa: 'AOA', g: 'G',
      mach: 'MACH', vs: 'V/S', trk: 'TRK', fuel: 'FUEL', aos: 'AOS',
      hdg: 'HDG', thr: 'THR', oil: 'OIL', eng1: 'ENG 1', eng2: 'ENG 2', single: 'SINGLE',
      lamp_gear: 'GEAR', lamp_flaps: 'FLAPS', lamp_brake: 'AIRBRK', lamp_wep: 'WEP', lamp_fuel: 'FUEL', lamp_ovspd: 'OVERSPD', lamp_stall: 'STALL', lamp_link: 'LINK',
      gear: 'GEAR', engLeft: 'ENG L', engRight: 'ENG R', nose: 'NOSE', spd: 'SPD', vel: 'VEL'
    },
    ru: {
      settings: 'НАСТРОЙКИ', themeL: 'ИНДИКАЦИЯ', modelL: '3D МОДЕЛЬ', sensorL: 'ДАТЧИК', thrustL: 'ТЯГА', thrustU: 'Тяга', tAuto: 'Авто по типу', tManual: 'Вручную',
      calibL: 'КРЕН/ТАНГАЖ', filterL: 'ФИЛЬТР', fAir: 'Воздух', fGnd: 'Земля', fSur: 'Вода', dispL: 'ОТОБРАЖЕНИЕ', layoutL: 'РАСКЛАДКА', unitsL: 'ЕДИНИЦЫ', langL: 'ЯЗЫК', uiL: 'ТЕМА',
      done: 'ГОТОВО', autosave: 'Настройки сохраняются автоматически',
      tWide: 'ШИРОКИЙ', tF15: 'F-15', tPfd: 'F-16 PFD', tClassic: 'КЛАССИКА', tGlass: 'СТЕКЛО',
      sTgp: 'ИК', sWhot: 'БЕЛ', sBhot: 'ЧЁРН', sOff: 'ТВ',
      flipP: 'Инверсия тангажа', flipR: 'Инверсия крена', fpmBtn: 'Вектор', scaleBtn: 'Шкала крена',
      lAuto: 'Авто', lLr: 'Слева/справа', lTb: 'Сверху/снизу', lMfd: 'Только MFD', l3d: 'Только 3D',
      uMetric: 'Метрич.', uImp: 'Имперск.',
      uiDark: 'Тёмная', uiLight: 'Светлая',
      modelLocal: 'Файл…', modelBuiltin: 'Встроенная', mScope: 'Авиагоризонт', mModel: '3D модель', mAxes: 'Оси', resetView: 'Сброс вида', resetModel: 'Сброс модели', dragHint: 'Тянуть — вращение · колесо — зум · двойной клик — сброс',

      att: 'ТАНГАЖ', calc: 'РАСЧЁТ', energy: 'ЭНЕРГИЯ', tactical: 'ОБСТАНОВКА', noContacts: 'НЕТ ЦЕЛЕЙ', legend: 'ЛЕГЕНДА', heading: 'КУРС', measuring: 'ЗАМЕР', kMsl: 'РАКЕТА', kAir: 'САМОЛЁТ', kGnd: 'ЗЕМЛЯ', kSur: 'КОРАБЛЬ', es: 'ЭНЕРГИЯ H+V²/2g', ps: 'МОЩНОСТЬ', turnR: 'СКОРОСТЬ', radius: 'РАДИУС', thrust: 'ТЯГА', accel: 'УСКОР', endur: 'ВРЕМЯ', range: 'ДАЛЬН', eng: 'ДВИГАТЕЛИ', nav: 'НАВИГАЦИЯ', data: 'ПОЛЁТ',
      ias: 'СКОРОСТЬ', alt: 'ВЫСОТА', pitch: 'ТАНГАЖ', bank: 'КРЕН', aoa: 'УА', g: 'ПЕРЕГР',
      mach: 'ЧИСЛО М', vs: 'ВАР', trk: 'ПУТЬ', fuel: 'ТОПЛИВО', aos: 'СКОЛЬЖ',
      hdg: 'КУРС', thr: 'РУД', oil: 'МАСЛО', eng1: 'ЛЕВ', eng2: 'ПРАВ', single: 'ОДИН',
      lamp_gear: 'ШАССИ', lamp_flaps: 'ЗАКР', lamp_brake: 'ТОРМ', lamp_wep: 'ФОРС', lamp_fuel: 'ТОПЛ', lamp_ovspd: 'СКОР', lamp_stall: 'СРЫВ', lamp_link: 'СВЯЗЬ',
      gear: 'ШАССИ', engLeft: 'ЛЕВ', engRight: 'ПРАВ', nose: 'НОС', spd: 'СКОР', vel: 'ВЕКТ'
    }
  };

  var lang = 'zh';
  var units = 'metric';

  var KZ = {
    setLang: function (l) { if (D[l]) lang = l; },
    getLang: function () { return lang; },
    setUnits: function (u) { units = (u === 'imperial') ? 'imperial' : 'metric'; },
    getUnits: function () { return units; },
    isImperial: function () { return units === 'imperial'; },

    t: function (k) {
      var d = D[lang] || D.zh;
      return d[k] || D.zh[k] || k;
    },

    /* 源数据单位：km/h, m, m/s, kg */
    speed: function (v) { return units === 'imperial' ? v * 0.539957 : v; },
    alt: function (v) { return units === 'imperial' ? v * 3.28084 : v; },
    vsi: function (v) { return units === 'imperial' ? v * 196.85 : v; },
    fuel: function (v) { return units === 'imperial' ? v * 2.20462 : v; },
    dist: function (v) { return units === 'imperial' ? v * 3.28084 : v; },

    speedUnit: function () { return units === 'imperial' ? 'KT' : 'KM/H'; },
    altUnit: function () { return units === 'imperial' ? 'FT' : 'M'; },
    vsiUnit: function () { return units === 'imperial' ? 'FT/MIN' : 'M/S'; },
    fuelUnit: function () { return units === 'imperial' ? 'LB' : 'KG'; },

    /* 速度表上限 / 刻度 */
    speedMax: function () { return units === 'imperial' ? 900 : 1600; },
    altMax: function () { return units === 'imperial' ? 50000 : 15000; },

    /* 把 [data-i18n] 的静态文案刷成当前语言 */
    applyDom: function (root) {
      var scope = root || document;
      var list = scope.querySelectorAll('[data-i18n]');
      for (var i = 0; i < list.length; i++) {
        var k = list[i].getAttribute('data-i18n');
        list[i].textContent = KZ.t(k);
      }
    }
  };

  window.KZ = KZ;
})();
