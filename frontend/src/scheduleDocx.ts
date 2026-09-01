import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { calendarDuties, fixedNightHours } from "./nightDuties";
import type {
  ExternalDutyAssignment,
  GenerateResponse,
  ScheduleConfiguration,
  WorkAssignment,
} from "./types";

const DAY_NAMES = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
] as const;

// Named layout override for a seven-day schedule: A4 landscape, compact margins.
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 600;
const TABLE_INDENT = 120;
const TABLE_WIDTH = 15518;
const COLUMN_WIDTHS = [2700, 1831, 1831, 1831, 1831, 1831, 1831, 1832];
const NAVY = "102C3E";
const TEAL = "007F78";
const MUTED = "526474";
const GRID = "B8C6CE";
const HEADER_FILL = "E8EEF5";
const WEEKEND_FILL = "F4F7F8";

interface ScheduleEntry {
  startMinute: number;
  endMinute: number;
  label: string;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(date: string, includeYear = true): string {
  const [year, month, day] = date.split("-");
  return includeYear ? `${day}.${month}.${year}` : `${day}.${month}`;
}

function minutesToTime(minutes: number): string {
  if (minutes === 1440) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} godz. ${rest} min` : `${hours} godz.`;
}

function safeFilePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function assignmentEntry(
  assignment: WorkAssignment,
  configuration: ScheduleConfiguration,
): ScheduleEntry {
  const group = configuration.groups.find((item) => item.id === assignment.groupId);
  const active = assignment.groupId === configuration.activeGroupId;
  return {
    startMinute: assignment.startMinute,
    endMinute: assignment.endMinute,
    label: active ? "Opieka" : `Inna grupa ${group?.code ?? assignment.groupId}`,
  };
}

function dutyEntry(duty: ExternalDutyAssignment & { startMinute: number; endMinute: number }): ScheduleEntry {
  const label =
    duty.dutyType === "NIGHT"
      ? "Nocka"
      : duty.dutyType === "SCHOOL"
        ? "Szkoła"
        : duty.dutyType === "DINING_ROOM"
          ? "Stołówka"
          : duty.description || "Inny dyżur";
  return {
    startMinute: duty.startMinute,
    endMinute: duty.endMinute,
    label,
  };
}

function textParagraph(
  text: string,
  options: {
    bold?: boolean;
    color?: string;
    size?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.alignment ?? AlignmentType.LEFT,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 0,
      line: 240,
    },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        color: options.color ?? NAVY,
        size: options.size ?? 16,
        font: "Calibri",
      }),
    ],
  });
}

function cell(
  children: Paragraph[],
  width: number,
  shading?: string,
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      marginUnitType: WidthType.DXA,
      top: 80,
      bottom: 80,
      left: 120,
      right: 120,
    },
    shading: shading
      ? { fill: shading, color: "auto", type: ShadingType.CLEAR }
      : undefined,
    children,
  });
}

function entriesForDay(
  educatorId: string,
  date: string,
  assignments: WorkAssignment[],
  duties: ReturnType<typeof calendarDuties>,
  configuration: ScheduleConfiguration,
): ScheduleEntry[] {
  return [
    ...assignments
      .filter((item) => item.educatorId === educatorId && item.date === date)
      .map((item) => assignmentEntry(item, configuration)),
    ...duties
      .filter((item) => item.educatorId === educatorId && item.date === date)
      .map(dutyEntry),
  ].sort(
    (left, right) =>
      left.startMinute - right.startMinute || left.endMinute - right.endMinute,
  );
}

function scheduleTable(
  weekDates: string[],
  configuration: ScheduleConfiguration,
  generation: GenerateResponse,
): Table {
  const groupMemberships = configuration.groupMemberships.filter(
    (item) => item.active && item.groupId === configuration.activeGroupId,
  );
  const memberIds = new Set(groupMemberships.map((item) => item.educatorId));
  const educators = configuration.educators.filter(
    (item) => item.active && memberIds.has(item.id),
  );
  const duties = calendarDuties(configuration).filter((item) =>
    weekDates.includes(item.date),
  );
  const assignments = generation.assignments.filter((item) =>
    weekDates.includes(item.date),
  );
  const weekIndex = Math.floor(
    (new Date(`${weekDates[0]}T12:00:00Z`).getTime() -
      new Date(`${configuration.cycleStartDate}T12:00:00Z`).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell(
        [textParagraph("Wychowawca", { bold: true, size: 17 })],
        COLUMN_WIDTHS[0],
        HEADER_FILL,
      ),
      ...weekDates.map((date, index) =>
        cell(
          [
            textParagraph(DAY_NAMES[index], {
              bold: true,
              size: 16,
              alignment: AlignmentType.CENTER,
            }),
            textParagraph(formatDate(date, false), {
              size: 15,
              color: MUTED,
              alignment: AlignmentType.CENTER,
            }),
          ],
          COLUMN_WIDTHS[index + 1],
          index >= 5 ? WEEKEND_FILL : HEADER_FILL,
        ),
      ),
    ],
  });

  const rows = educators.map((educator) => {
    const membership = groupMemberships.find(
      (item) => item.educatorId === educator.id,
    );
    const groupMinutes = assignments
      .filter(
        (item) =>
          item.educatorId === educator.id &&
          item.groupId === configuration.activeGroupId,
      )
      .reduce((sum, item) => sum + item.endMinute - item.startMinute, 0);
    const nightMinutes = membership
      ? fixedNightHours(configuration, membership, weekIndex) * 60
      : 0;
    const workDates = new Set([
      ...assignments
        .filter((item) => item.educatorId === educator.id)
        .map((item) => item.date),
      ...duties
        .filter((item) => item.educatorId === educator.id)
        .map((item) => item.date),
    ]);
    return new TableRow({
      cantSplit: true,
      children: [
        cell(
          [
            textParagraph(educator.displayName, { bold: true, size: 16 }),
            textParagraph(
              `${formatMinutes(groupMinutes + nightMinutes)} · ${workDates.size} dni pracy`,
              { size: 15, color: MUTED, after: 0 },
            ),
          ],
          COLUMN_WIDTHS[0],
        ),
        ...weekDates.map((date, dayIndex) => {
          const entries = entriesForDay(
            educator.id,
            date,
            assignments,
            duties,
            configuration,
          );
          const paragraphs = entries.length
            ? entries.map((entry) =>
                textParagraph(
                  `${minutesToTime(entry.startMinute)}–${minutesToTime(entry.endMinute)} ${entry.label}`,
                  { size: 16, after: 30 },
                ),
              )
            : [
                textParagraph("Wolne", {
                  size: 16,
                  color: "6E7B84",
                  alignment: AlignmentType.CENTER,
                }),
              ];
          return cell(
            paragraphs,
            COLUMN_WIDTHS[dayIndex + 1],
            dayIndex >= 5 ? "FAFBFB" : undefined,
          );
        }),
      ],
    });
  });

  const border = { style: BorderStyle.SINGLE, size: 4, color: GRID };
  return new Table({
    rows: [header, ...rows],
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: COLUMN_WIDTHS,
    indent: { size: TABLE_INDENT, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
  });
}

function pageHeader(label: string): Header {
  return new Header({
    children: [
      textParagraph(label, {
        size: 15,
        color: MUTED,
        alignment: AlignmentType.RIGHT,
      }),
    ],
  });
}

function pageFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: "Harmonogram MOW · strona ", size: 15, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED }),
          new TextRun({ text: " z ", size: 15, color: MUTED }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: MUTED }),
        ],
      }),
    ],
  });
}

export function createScheduleDocument(
  configuration: ScheduleConfiguration,
  generation: GenerateResponse,
): Document {
  const group = configuration.groups.find(
    (item) => item.id === configuration.activeGroupId,
  );
  if (!group) throw new Error("Nie znaleziono aktywnej grupy.");
  const exportedAt = new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const headerLabel = `${configuration.projectName} · ${group.code} · ${group.name}`;
  const sections = Array.from(
    { length: configuration.planningHorizonWeeks },
    (_, weekIndex) => {
      const weekDates = Array.from({ length: 7 }, (_, dayIndex) =>
        addDays(configuration.cycleStartDate, weekIndex * 7 + dayIndex),
      );
      return {
        headers: { default: pageHeader(headerLabel) },
        footers: { default: pageFooter() },
        properties: {
          ...(weekIndex > 0 ? { type: SectionType.NEXT_PAGE } : {}),
          page: {
            size: {
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: PAGE_MARGIN,
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
              header: 360,
              footer: 360,
              gutter: 0,
            },
          },
        },
        children: [
          new Paragraph({
            style: "ScheduleTitle",
            children: [
              new TextRun({
                text: `Harmonogram pracy · ${group.code} · ${group.name}`,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            style: "WeekHeading",
            children: [
              new TextRun({
                text: `Tydzień ${weekIndex + 1}: ${formatDate(weekDates[0])}–${formatDate(weekDates[6])}`,
                bold: true,
              }),
            ],
          }),
          textParagraph(
            [
              group.classLabel ? `Klasa: ${group.classLabel}` : null,
              `Projekt: ${configuration.projectName}`,
              `Wygenerowano: ${exportedAt}`,
            ]
              .filter(Boolean)
              .join(" · "),
            { size: 15, color: MUTED, after: 100 },
          ),
          scheduleTable(weekDates, configuration, generation),
          textParagraph(
            "Plan obejmuje opiekę w aktywnej grupie oraz widoczne obowiązki wpływające na dzień pracy: stałe nocki, szkołę i pracę w innych grupach.",
            { size: 14, color: MUTED, before: 100 },
          ),
        ],
      };
    },
  );

  return new Document({
    title: `Harmonogram ${group.code} · ${configuration.planningHorizonWeeks} tygodni`,
    subject: "Edytowalny harmonogram pracy wychowawców",
    creator: "Harmonogram MOW",
    description: "Plan wygenerowany i sprawdzony w aplikacji Harmonogram MOW.",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20, color: NAVY },
          paragraph: { spacing: { before: 0, after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: "ScheduleTitle",
          name: "Tytuł harmonogramu",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 32, bold: true, color: NAVY },
          paragraph: { spacing: { before: 0, after: 80, line: 300 }, keepNext: true },
        },
        {
          id: "WeekHeading",
          name: "Nagłówek tygodnia",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 24, bold: true, color: TEAL },
          paragraph: { spacing: { before: 0, after: 60, line: 300 }, keepNext: true },
        },
      ],
    },
    sections,
  });
}

export async function createScheduleDocxBlob(
  configuration: ScheduleConfiguration,
  generation: GenerateResponse,
): Promise<Blob> {
  return Packer.toBlob(createScheduleDocument(configuration, generation));
}

export function scheduleDocxFileName(configuration: ScheduleConfiguration): string {
  const group = configuration.groups.find(
    (item) => item.id === configuration.activeGroupId,
  );
  const groupPart = safeFilePart(group?.code || group?.name || "plan") || "plan";
  return `harmonogram-${groupPart}-${configuration.planningHorizonWeeks}-tygodni-${configuration.cycleStartDate}.docx`;
}

export async function downloadScheduleDocx(
  configuration: ScheduleConfiguration,
  generation: GenerateResponse,
): Promise<string> {
  const blob = await createScheduleDocxBlob(configuration, generation);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fileName = scheduleDocxFileName(configuration);
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return fileName;
}
