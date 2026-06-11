import type { LucideIcon } from "lucide-react";
import {
  CircleHelp,
  Headphones,
  Keyboard,
  Monitor,
  Network,
  Printer,
  Shield,
  Wifi,
} from "lucide-react";

const ICON_RULES: { match: RegExp; icon: LucideIcon }[] = [
  { match: /гарнитур|headset|наушник|микрофон/i, icon: Headphones },
  { match: /клавиатур|мыш|keyboard|mouse/i, icon: Keyboard },
  { match: /монитор|экран|display|screen/i, icon: Monitor },
  { match: /принтер|печат|printer/i, icon: Printer },
  { match: /сеть|wifi|интернет|network|vpn/i, icon: Wifi },
  { match: /почт|email|outlook|mail/i, icon: Network },
  { match: /доступ|парол|учётн|account|security/i, icon: Shield },
];

const HINT_RULES: { match: RegExp; hints: string[] }[] = [
  {
    match: /гарнитур|headset|наушник/i,
    hints: [
      "Проверьте, что кабель USB полностью вставлен",
      "Перезапустите softphone или Teams",
      "Убедитесь, что в системе выбрано правильное устройство ввода",
    ],
  },
  {
    match: /клавиатур|мыш/i,
    hints: [
      "Попробуйте другой USB-порт",
      "Перезагрузите компьютер",
      "Проверьте, нет ли физических повреждений кабеля",
    ],
  },
  {
    match: /монитор|экран/i,
    hints: [
      "Проверьте кабель HDMI/DisplayPort",
      "Попробуйте Win+P → «Расширить»",
      "Убедитесь, что монитор включён и выбран верный источник",
    ],
  },
  {
    match: /сеть|wifi|интернет|vpn/i,
    hints: [
      "Переподключитесь к Wi-Fi",
      "Проверьте, работает ли интернет у соседей",
      "Перезапустите VPN-клиент, если используете",
    ],
  },
  {
    match: /почт|outlook|email/i,
    hints: [
      "Проверьте подключение к интернету",
      "Закройте и откройте Outlook заново",
      "Уточните текст ошибки — это ускорит решение",
    ],
  },
];

const DEFAULT_HINTS = [
  "Опишите, когда проблема началась",
  "Укажите текст ошибки, если он есть",
  "Приложите скриншот — Ctrl+V в зону вложений",
];

export function categoryIcon(name: string): LucideIcon {
  for (const rule of ICON_RULES) {
    if (rule.match.test(name)) return rule.icon;
  }
  return CircleHelp;
}

export function getCategoryHints(name: string): string[] {
  for (const rule of HINT_RULES) {
    if (rule.match.test(name)) return rule.hints;
  }
  return DEFAULT_HINTS;
}

export function computeFormStep(
  row: string,
  desk: string,
  categoryId: string,
  description: string,
): number {
  if (!row.trim() || !desk.trim()) return 1;
  if (!categoryId) return 2;
  if (!description.trim()) return 3;
  return 4;
}
