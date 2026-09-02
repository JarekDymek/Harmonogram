import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  createScheduleDocxBlob,
  createScheduleDocxFile,
  scheduleDocxFileName,
} from "../scheduleDocx";
import type { GenerateResponse } from "../types";
import { configurationFixture } from "./fixture";

describe("edytowalny eksport Word", () => {
  it("tworzy prawidłowy kontener DOCX dla całego horyzontu", async () => {
    const configuration = structuredClone(configurationFixture);
    configuration.planningHorizonWeeks = 6;
    configuration.groupMemberships = configuration.groupMemberships.map((item) => ({
      ...item,
      weeklyTargetHoursByWeek: Array(6).fill(item.weeklyTargetHoursByWeek[0]),
    }));
    const generation: GenerateResponse = {
      generationStatus: "CANDIDATE_FOUND",
      publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
      assignments: Array.from({ length: 6 }, (_, week) => ({
        groupId: "G1",
        educatorId: "A",
        date: new Date(Date.UTC(2026, 8, 14 + week * 7)).toISOString().slice(0, 10),
        startMinute: 360,
        endMinute: 480,
      })),
      care: [],
      messages: [],
      validationReport: {
        status: "VALID",
        publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
        validatorVersion: "3.1.0",
        messages: [],
        legalProfileStatus: "UNVERIFIED",
        legalProfileVersion: "test",
      },
    };

    const blob = await createScheduleDocxBlob(configuration, generation);
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blob);
    });

    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(bytes.length).toBeGreaterThan(5000);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("string");
    const documentXml = new DOMParser().parseFromString(xml, "text/xml");
    const wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    expect(documentXml.getElementsByTagNameNS(wordNamespace, "tbl")).toHaveLength(6);
    expect(documentXml.getElementsByTagNameNS(wordNamespace, "sectPr")).toHaveLength(6);
    expect(scheduleDocxFileName(configuration)).toBe(
      "harmonogram-i-6-tygodni-2026-09-14.docx",
    );
    const file = await createScheduleDocxFile(configuration, generation);
    expect(file.name).toBe(scheduleDocxFileName(configuration));
    expect(file.type).toBe(blob.type);
    expect(file.size).toBeGreaterThan(5000);
    await expect(createScheduleDocxFile(configuration, { ...generation, validationReport: null }))
      .rejects.toThrow("Najpierw wygeneruj i sprawdź harmonogram.");
  });
});
