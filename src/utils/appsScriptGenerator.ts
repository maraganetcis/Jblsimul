/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Team, Player, HistorySeason, MatchRecord, Position, PotentialGrade } from '../types/baseball';
import { generatePlayer } from '../data/initialLeagueData';

export interface GameExportPayload {
  exportDate: string;
  seasonNumber: number;
  currentDay?: number;
  userTeam: Team;
  allTeams: Team[];
  userRoster: Player[];
  allPlayers: Record<string, Player[]>;
  historicalChampions: HistorySeason[];
  tradeLogs: Array<{ date: string; description: string }>;
  draftLogs: Array<{ round: number; pickNumber: number; teamName: string; playerName: string; position: string; school: string }>;
  matchHistory?: MatchRecord[];
}

export const SAMPLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * JBL 프로야구단 매니저 - 전체 리그 양방향 동기화 Apps Script (v2.1)
 * ==============================================================================
 * [기능]
 * - 저장(doPost): 현재 회차/일차 + 10개 구단 전체 기록 + 전체 구단 타자/투수 명단 및 스탯 +
 *                 리그 순위표 + 역대 우승족보 + 경기 박스스코어 + 트레이드/드래프트 이력을 8개 탭으로 저장
 * - 불러오기(doGet): 구글 시트에서 수정/추가한 회차, 구단 성적, 선수 이름/포지션/스탯을
 *                    게임으로 그대로 불러와 동기화!
 *
 * [설치 및 배포 방법]
 * 1. 구글 스프레드시트 [확장 프로그램] -> [Apps Script] 클릭
 * 2. 기존 코드를 모두 지우고 이 코드 전체를 붙여넣기 후 저장(Ctrl+S)
 * 3. 우측 상단 [배포] -> [새 배포] -> 유형: [웹 앱]
 *    - 다음 사용자 권한으로 실행: 나(내 계정)
 *    - 액세스 권한이 있는 사용자: [모든 사용자 (Anyone)] (필수!)
 * 4. 발급된 웹 앱 URL을 게임 내 [스프레드시트 연동] Webhook URL에 저장!
 * (주의: 기존 배포를 업데이트할 때는 [배포] -> [배포 관리] -> 연필 아이콘 -> 새 버전으로 배포하세요)
 * ==============================================================================
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚾ JBL 리그 매니저")
    .addItem("📥 게임 JSON 붙여넣어 시트 전체 갱신", "importJsonPrompt")
    .addItem("📤 현재 시트 -> 게임용 JSON 추출", "exportJsonDialog")
    .addToUi();
}

function importJsonPrompt() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt("JBL 게임 JSON 붙여넣기", "게임의 [전체 리그 JSON 복사] 버튼으로 복사한 내용을 붙여넣으세요:", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  try {
    var payload = JSON.parse(res.getResponseText());
    writeAllPayloadToSheets(SpreadsheetApp.getActiveSpreadsheet(), payload);
    ui.alert("완료!", "구글 시트의 모든 탭이 최신 게임 데이터로 업데이트되었습니다.", ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("오류", "올바른 JSON 형식이 아닙니다: " + err.toString(), ui.ButtonSet.OK);
  }
}

function exportJsonDialog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = buildExportDataObject(ss);
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif;font-size:13px;">아래 전체 내용을 복사(Ctrl+A, Ctrl+C)하여 게임의 [CSV/JSON 붙여넣기 동기화]에 넣으세요:</p>' +
    '<textarea style="width:100%;height:300px;font-family:monospace;font-size:11px;" readonly onclick="this.select()">' +
    JSON.stringify(data) +
    '</textarea>'
  ).setWidth(560).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, "JBL 리그 데이터 내보내기");
}

function buildExportDataObject(ss) {
  return {
    meta: readMetaSheet(ss),
    teams: readTeamsSheet(ss),
    batters: readBattersSheet(ss),
    pitchers: readPitchersSheet(ss),
    historicalChampions: readHistorySheet(ss),
    matchHistory: readMatchesSheet(ss),
    tradeLogs: readActivitySheet(ss).tradeLogs,
    draftLogs: readActivitySheet(ss).draftLogs
  };
}

function writeAllPayloadToSheets(ss, payload) {
  syncMetaSheet(ss, payload);
  syncTeamInfoSheet(ss, payload);
  syncBatterSheet(ss, payload);
  syncPitcherSheet(ss, payload);
  syncStandingsSheet(ss, payload);
  syncHistorySheet(ss, payload);
  syncMatchesSheet(ss, payload);
  syncActivitySheet(ss, payload);
  SpreadsheetApp.flush();
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "sync";

    if (action === "ping") {
      var sheetNames = ss.getSheets().map(function(s) { return s.getName(); });
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        version: "2.1",
        spreadsheetName: ss.getName(),
        sheets: sheetNames,
        message: "Apps Script 연결 성공! 시트 [" + ss.getName() + "]와 정상 통신 중입니다."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      version: "2.1",
      message: "구글 시트에서 전체 리그 및 선수 데이터를 성공적으로 불러왔습니다.",
      fetchedAt: new Date().toISOString(),
      data: buildExportDataObject(ss)
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var rawData = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    if (!rawData) {
      throw new Error("전송된 POST 데이터가 비어 있습니다.");
    }
    var payload = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    writeAllPayloadToSheets(ss, payload);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      version: "2.1",
      spreadsheetName: ss.getName(),
      message: "전체 10개 구단 및 선수단, 회차 기록이 시트 [" + ss.getName() + "]의 8개 탭에 저장되었습니다!",
      syncedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.clear();
  return sheet;
}

function styleHeaderRow(sheet, numCols, bgColor) {
  var range = sheet.getRange(1, 1, 1, numCols);
  range.setBackground(bgColor || "#0369A1")
       .setFontColor("#FFFFFF")
       .setFontWeight("bold")
       .setHorizontalAlignment("center");
}

function syncMetaSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "0.리그상태_메타");
  var rows = [
    ["항목", "값"],
    ["현재회차", p.seasonNumber || 26],
    ["진행일차", p.currentDay || 1],
    ["선택구단ID", p.userTeam ? p.userTeam.id : "team_jido"],
    ["선택구단명", p.userTeam ? p.userTeam.name : ""],
    ["동기화일시", p.exportDate || new Date().toLocaleString()]
  ];
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  styleHeaderRow(sheet, 2, "#0284C7");
  sheet.autoResizeColumns(1, 2);
}

function syncTeamInfoSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "1.구단정보");
  var headers = ["구단ID", "구단명", "소유주", "홈구장", "창단년도", "역대우승수", "구단자금", "타격장Lv", "투구랩Lv", "웨이트Lv", "메디컬Lv", "승", "무", "패", "득점", "실점"];
  var rows = [headers];
  (p.allTeams || []).forEach(function(t) {
    var f = t.facilityLevels || {};
    rows.push([
      t.id, t.name, t.owner, t.homeStadium, t.foundedYear || 1, t.championships || 0,
      t.budget || 400000, f.battingCage || 2, f.pitchingLab || 2, f.weightRoom || 2, f.medicalCenter || 2,
      t.wins || 0, t.draws || 0, t.losses || 0, t.runsScored || 0, t.runsAllowed || 0
    ]);
  });
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeaderRow(sheet, headers.length, "#1E3A8A");
  sheet.autoResizeColumns(1, headers.length);
}

function syncBatterSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "2.전체선수_타자");
  var headers = ["선수ID", "구단명", "구단ID", "이름", "포지션", "군", "나이", "잠재력", "레벨", "컨택", "파워", "선구안", "주력", "수비", "클러치", "경기", "타석", "안타", "2루타", "3루타", "홈런", "타점", "득점", "볼넷", "삼진", "도루", "타율", "출루율", "장타율", "OPS"];
  var rows = [headers];
  var teamMap = {};
  (p.allTeams || []).forEach(function(t) { teamMap[t.id] = t.name; });

  var allPlayersObj = p.allPlayers || {};
  Object.keys(allPlayersObj).forEach(function(teamId) {
    var roster = allPlayersObj[teamId] || [];
    roster.filter(function(x) { return x.role === "BATTER"; }).forEach(function(b) {
      var s = b.batterStats || {};
      var ab = s.atBats || 0;
      var h = s.hits || 0;
      var hr = s.homeRuns || 0;
      var d = s.doubles || 0;
      var t = s.triples || 0;
      var bb = s.walks || 0;
      var avg = ab > 0 ? (h / ab).toFixed(3) : ".000";
      var obp = (ab + bb) > 0 ? ((h + bb) / (ab + bb)).toFixed(3) : ".000";
      var tb = (h - d - t - hr) + (d * 2) + (t * 3) + (hr * 4);
      var slg = ab > 0 ? (tb / ab).toFixed(3) : ".000";
      var ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);

      rows.push([
        b.id, teamMap[teamId] || teamId, teamId, b.name, b.primaryPosition,
        b.tier === "FIRST_TEAM" ? "1군" : "2군", b.age, b.potential, b.level || 1,
        s.contact || 60, s.power || 60, s.eye || 60, s.speed || 60, s.defense || 60, s.clutch || 60,
        s.games || 0, ab, h, d, t, hr, s.rbi || 0, s.runs || 0, bb, s.strikeouts || 0, s.stolenBases || 0,
        avg, obp, slg, ops
      ]);
    });
  });

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    styleHeaderRow(sheet, headers.length, "#0F766E");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function syncPitcherSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "3.전체선수_투수");
  var headers = ["선수ID", "구단명", "구단ID", "이름", "보직", "군", "나이", "잠재력", "레벨", "최고구속", "제구", "구위", "체력", "클러치", "경기", "이닝아웃", "이닝", "승", "패", "세이브", "홀드", "탈삼진", "피안타", "사사구", "자책점", "방어율(ERA)", "WHIP"];
  var rows = [headers];
  var teamMap = {};
  (p.allTeams || []).forEach(function(t) { teamMap[t.id] = t.name; });

  var allPlayersObj = p.allPlayers || {};
  Object.keys(allPlayersObj).forEach(function(teamId) {
    var roster = allPlayersObj[teamId] || [];
    roster.filter(function(x) { return x.role === "PITCHER"; }).forEach(function(pc) {
      var s = pc.pitcherStats || {};
      var ipOuts = s.inningsOuts || 0;
      var fullIp = Math.floor(ipOuts / 3);
      var partIp = ipOuts % 3;
      var ipStr = fullIp + (partIp > 0 ? "." + partIp : "");
      var floatIp = ipOuts / 3;
      var era = floatIp > 0 ? ((s.earnedRuns || 0) * 9 / floatIp).toFixed(2) : "0.00";
      var whip = floatIp > 0 ? (((s.hitsAllowed || 0) + (s.walksAllowed || 0)) / floatIp).toFixed(2) : "0.00";

      rows.push([
        pc.id, teamMap[teamId] || teamId, teamId, pc.name, pc.primaryPosition,
        pc.tier === "FIRST_TEAM" ? "1군" : "2군", pc.age, pc.potential, pc.level || 1,
        s.velocity || 144, s.control || 60, s.stuff || 60, s.stamina || 65, s.clutch || 60,
        s.games || 0, ipOuts, ipStr, s.wins || 0, s.losses || 0, s.saves || 0, s.holds || 0,
        s.strikeouts || 0, s.hitsAllowed || 0, s.walksAllowed || 0, s.earnedRuns || 0, era, whip
      ]);
    });
  });

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    styleHeaderRow(sheet, headers.length, "#7C2D12");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function syncStandingsSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "4.리그순위표");
  var headers = ["순위", "구단명", "경기수", "승", "무", "패", "승률", "득점", "실점", "득실마진"];
  var rows = [headers];
  var sorted = (p.allTeams || []).slice().sort(function(a, b) {
    var winRateA = (a.wins + a.losses > 0) ? (a.wins / (a.wins + a.losses)) : 0;
    var winRateB = (b.wins + b.losses > 0) ? (b.wins / (b.wins + b.losses)) : 0;
    if (winRateB !== winRateA) return winRateB - winRateA;
    return (b.wins - a.wins);
  });
  sorted.forEach(function(t, idx) {
    var games = t.wins + t.losses + t.draws;
    var winRate = (t.wins + t.losses > 0) ? (t.wins / (t.wins + t.losses)).toFixed(3) : ".000";
    rows.push([idx + 1, t.name, games, t.wins, t.draws, t.losses, winRate, t.runsScored || 0, t.runsAllowed || 0, (t.runsScored || 0) - (t.runsAllowed || 0)]);
  });
  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    styleHeaderRow(sheet, headers.length, "#1E293B");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function syncHistorySheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "5.역대_우승족보");
  var headers = ["회차(시즌)", "우승구단"];
  var rows = [headers];
  (p.historicalChampions || []).forEach(function(h) {
    rows.push([h.seasonNumber, h.champion]);
  });
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeaderRow(sheet, headers.length, "#9333EA");
  sheet.autoResizeColumns(1, headers.length);
}

function syncMatchesSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "6.경기기록_박스스코어");
  var headers = ["일자", "시즌", "매치업", "원정팀", "원정점수", "홈팀", "홈점수", "결과", "승리팀", "원정안타", "홈안타", "경기요약"];
  var rows = [headers];
  var history = p.matchHistory || [];
  history.forEach(function(m) {
    rows.push([
      m.day, m.seasonNumber, m.awayTeamName + " vs " + m.homeTeamName,
      m.awayTeamName, m.awayScore, m.homeTeamName, m.homeScore,
      m.result === "WIN" ? "승리" : m.result === "LOSS" ? "패배" : "무승부",
      m.winningTeamName, m.awayHits, m.homeHits, m.summary || ""
    ]);
  });
  if (rows.length === 1) {
    rows.push([0, p.seasonNumber || 26, "진행된 경기 없음", "-", 0, "-", 0, "-", "-", 0, 0, "-"]);
  }
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeaderRow(sheet, headers.length, "#0369A1");
  sheet.autoResizeColumns(1, headers.length);
}

function syncActivitySheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "7.트레이드_드래프트_이력");
  var headers = ["유형", "일자/라운드", "상세 내용"];
  var rows = [headers];
  (p.tradeLogs || []).forEach(function(t) { rows.push(["트레이드", t.date, t.description]); });
  (p.draftLogs || []).forEach(function(d) {
    rows.push(["신인 드래프트", d.round + "라운드 (" + d.pickNumber + "순위)", d.teamName + " -> " + d.playerName + " (" + d.position + ", " + d.school + ")"]);
  });
  if (rows.length === 1) {
    rows.push(["안내", "-", "아직 진행된 트레이드 또는 드래프트 기록이 없습니다."]);
  }
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeaderRow(sheet, headers.length, "#C2410C");
  sheet.autoResizeColumns(1, headers.length);
}

// ---------- 불러오기 (doGet) 파서 함수들 ----------
function sheetToObjects(sheet) {
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var list = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row.some(function(cell) { return cell !== "" && cell !== null; })) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[String(headers[j]).trim()] = row[j];
    }
    list.push(obj);
  }
  return list;
}

function readMetaSheet(ss) {
  var sheet = ss.getSheetByName("0.리그상태_메타");
  if (!sheet) return {};
  var values = sheet.getDataRange().getValues();
  var meta = {};
  for (var i = 1; i < values.length; i++) {
    var k = String(values[i][0]).trim();
    var v = values[i][1];
    if (k === "현재회차") meta.seasonNumber = parseInt(String(v).replace(/[^0-9]/g, ""), 10) || 26;
    if (k === "진행일차") meta.currentDay = parseInt(String(v).replace(/[^0-9]/g, ""), 10) || 1;
    if (k === "선택구단ID") meta.selectedTeamId = String(v).trim();
  }
  return meta;
}

function readTeamsSheet(ss) {
  return sheetToObjects(ss.getSheetByName("1.구단정보"));
}

function readBattersSheet(ss) {
  return sheetToObjects(ss.getSheetByName("2.전체선수_타자") || ss.getSheetByName("2.선수단_타자"));
}

function readPitchersSheet(ss) {
  return sheetToObjects(ss.getSheetByName("3.전체선수_투수") || ss.getSheetByName("3.선수단_투수"));
}

function readHistorySheet(ss) {
  return sheetToObjects(ss.getSheetByName("5.역대_우승족보"));
}

function readMatchesSheet(ss) {
  return sheetToObjects(ss.getSheetByName("6.경기기록_박스스코어"));
}

function readActivitySheet(ss) {
  var rows = sheetToObjects(ss.getSheetByName("7.트레이드_드래프트_이력"));
  var tradeLogs = [];
  rows.forEach(function(r) {
    if (r["유형"] === "트레이드") {
      tradeLogs.push({ date: String(r["일자/라운드"] || ""), description: String(r["상세 내용"] || "") });
    }
  });
  return { tradeLogs: tradeLogs, draftLogs: [] };
}
`;

export function validateWebhookUrl(rawUrl: string): { valid: boolean; reason?: string; isSchoolDomain?: boolean } {
  const url = (rawUrl || '').trim();
  if (!url) {
    return { valid: false, reason: 'Apps Script 웹앱 URL을 입력해주세요.' };
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, reason: 'URL은 반드시 https:// 로 시작해야 합니다.' };
  }
  if (url.includes('docs.google.com/spreadsheets')) {
    return {
      valid: false,
      reason:
        '입력하신 주소는 "구글 스프레드시트 문서 주소"입니다! 시트 주소 대신 [확장 프로그램 → Apps Script → 배포 → 새 배포 → 웹 앱]에서 발급되는 "https://script.google.com/macros/s/.../exec" 주소를 입력해주세요.',
    };
  }
  if (url.includes('/edit')) {
    return {
      valid: false,
      reason:
        'Apps Script 편집기 주소(/edit)가 아니라 [배포 → 웹 앱] 후 생성되는 "/exec"로 끝나는 URL을 입력해야 합니다.',
    };
  }
  if (url.endsWith('/dev') || url.includes('/dev?')) {
    return {
      valid: false,
      reason:
        '테스트 배포 주소(/dev)는 로그인 세션이 필요해 외부에서 차단됩니다. [배포 → 새 배포]로 발급된 "/exec" 주소를 입력해주세요.',
    };
  }
  if (url.includes('/a/macros/')) {
    return {
      valid: true,
      isSchoolDomain: true,
      reason:
        '학교/기관 Workspace 전용 URL(/a/macros/...)입니다. 기관 보안 정책이 외부 웹앱 접근("모든 사용자")을 차단하면 연결이 실패할 수 있습니다.',
    };
  }
  if (!url.includes('script.google.com')) {
    return {
      valid: false,
      reason: 'Google Apps Script 웹앱 주소(https://script.google.com/macros/s/.../exec)가 아닙니다.',
    };
  }
  return { valid: true };
}

export async function testAppsScriptConnection(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  const check = validateWebhookUrl(webhookUrl);
  if (!check.valid) {
    return { success: false, message: check.reason || '올바른 URL이 아닙니다.' };
  }

  const cleanUrl = webhookUrl.trim();
  const pingUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=ping`;

  try {
    const res = await fetch(pingUrl, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        message:
          'Google 로그인 페이지 또는 HTML이 반환되었습니다. 배포 시 [액세스 권한이 있는 사용자]를 반드시 "모든 사용자(Anyone)"로 설정했는지(학교 계정은 차단될 수 있음) 확인해주세요.',
      };
    }

    if (json?.status === 'success' && json?.spreadsheetName) {
      return {
        success: true,
        message: `연결 성공! 시트 [${json.spreadsheetName}] (v${json.version || '2.1'}) · 현재 탭 ${Array.isArray(json.sheets) ? json.sheets.length : 0}개 확인됨`,
      };
    }
    if (json?.status === 'success') {
      return {
        success: true,
        message: `연결은 되었으나 구버전 스크립트입니다. 아래 v2.1 코드를 붙여넣고 [배포 → 배포 관리 → 연필 → 새 버전]으로 다시 배포하면 모든 기능이 작동합니다.`,
      };
    }
    return { success: false, message: json?.message || 'Apps Script가 오류를 반환했습니다.' };
  } catch (err) {
    const schoolHint = check.isSchoolDomain
      ? ' (학교/기관 Workspace 계정에서 외부 "모든 사용자" 웹앱 접근이 차단된 상태일 가능성이 높습니다! 아래 [시트 내 메뉴 방식]이나 [표 복사-붙여넣기]를 사용하면 바로 연동됩니다.)'
      : ' (배포 시 "모든 사용자(Anyone)" 권한을 선택했는지, 또는 새 버전으로 배포했는지 확인해주세요. 학교 계정은 개인 @gmail.com 계정이나 아래 [시트 내 메뉴 방식]을 이용하세요.)';
    return {
      success: false,
      message: `웹앱 연결 차단됨: ${err instanceof Error ? err.message : String(err)}${schoolHint}`,
    };
  }
}

export async function sendPayloadToGoogleAppsScript(webhookUrl: string, payload: GameExportPayload): Promise<{ success: boolean; message: string }> {
  const check = validateWebhookUrl(webhookUrl);
  if (!check.valid) {
    return { success: false, message: check.reason || '올바른 Google Apps Script 웹앱 URL을 입력해주세요.' };
  }

  const cleanUrl = webhookUrl.trim();

  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.status === 'success') {
        return {
          success: true,
          message: json.message || '전체 10개 구단·선수단·회차 기록이 구글 시트에 실제 저장되었습니다!',
        };
      }
      return {
        success: false,
        message: `Apps Script 실행 오류: ${json.message || '알 수 없는 오류'}`,
      };
    } catch {
      return {
        success: false,
        message:
          'Google 로그인 페이지로 리다이렉트되어 저장이 거부되었습니다. [배포]에서 액세스 권한을 "모든 사용자(Anyone)"로 설정했는지 확인하세요. (학교 계정 차단 시 아래 [JSON 복사 → 시트 메뉴 붙여넣기]를 이용하세요)',
      };
    }
  } catch (err) {
    const schoolHint = check.isSchoolDomain
      ? ' 학교/기관(.ms.kr 등) 계정은 외부 웹앱 전송을 차단할 수 있습니다. 아래 [전체 리그 JSON 복사] 후 구글 시트의 [⚾ JBL 리그 매니저] 메뉴를 사용하시면 100% 작동합니다!'
      : ' [연결 테스트] 버튼을 눌러 배포 권한("모든 사용자")과 URL을 확인해주세요.';
    return {
      success: false,
      message: `전송 실패 (CORS/권한 차단): ${err instanceof Error ? err.message : String(err)}.${schoolHint}`,
    };
  }
}

export interface PulledSheetSyncData {
  seasonNumber?: number;
  currentDay?: number;
  selectedTeamId?: string;
  teams?: Team[];
  playersMap?: Record<string, Player[]>;
  historicalChampions?: HistorySeason[];
  matchHistory?: MatchRecord[];
  tradeLogs?: Array<{ date: string; description: string }>;
  summaryText: string;
}

function normalizePosition(rawPos: string, fallbackRole: 'BATTER' | 'PITCHER'): Position {
  const s = (rawPos || '').trim().toUpperCase();
  const valid: Position[] = ['SP', 'RP', 'CP', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  if (valid.includes(s as Position)) return s as Position;

  if (s.includes('선발')) return 'SP';
  if (s.includes('마무리') || s.includes('클로저')) return 'CP';
  if (s.includes('불펜') || s.includes('중계') || s.includes('계투') || s.includes('구원')) return 'RP';
  if (s.includes('투수') || s === 'P') return 'SP';
  if (s.includes('포수')) return 'C';
  if (s.includes('1루')) return '1B';
  if (s.includes('2루')) return '2B';
  if (s.includes('3루')) return '3B';
  if (s.includes('유격')) return 'SS';
  if (s.includes('좌익')) return 'LF';
  if (s.includes('중견')) return 'CF';
  if (s.includes('우익')) return 'RF';
  if (s.includes('지명') || s.includes('지타')) return 'DH';
  if (s.includes('내야')) return 'SS';
  if (s.includes('외야')) return 'CF';

  return fallbackRole === 'PITCHER' ? 'SP' : 'DH';
}

function normalizePotential(raw: unknown): PotentialGrade {
  const s = String(raw || '').trim().toUpperCase();
  if (s.startsWith('S')) return 'S';
  if (s.startsWith('A')) return 'A';
  if (s.startsWith('B')) return 'B';
  if (s.startsWith('C')) return 'C';
  if (s.startsWith('D')) return 'D';
  return 'B';
}

function num(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  const cleaned = String(val ?? '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

function findTeamByNameOrId(teams: Team[], nameOrId: string): Team | undefined {
  const needle = (nameOrId || '').trim();
  if (!needle) return undefined;
  return (
    teams.find(t => t.id === needle || t.name === needle) ||
    teams.find(t => t.name.includes(needle) || needle.includes(t.name.split(' ')[1] || t.name))
  );
}

export function parseSheetDataPayload(
  d: any,
  currentTeams: Team[],
  currentPlayersMap: Record<string, Player[]>
): PulledSheetSyncData {
  const meta = d.meta || {};
  let nextTeams = [...currentTeams];

  if (Array.isArray(d.teams) && d.teams.length > 0) {
    nextTeams = currentTeams.map(team => {
      const match = d.teams.find((r: Record<string, unknown>) =>
        String(r['구단ID'] || '').trim() === team.id || String(r['구단명'] || '').trim() === team.name
      );
      if (!match) return team;
      return {
        ...team,
        owner: String(match['소유주'] || team.owner),
        homeStadium: String(match['홈구장'] || team.homeStadium),
        foundedYear: num(match['창단년도'], team.foundedYear),
        championships: num(match['역대우승수'], team.championships),
        budget: num(match['구단자금'], team.budget),
        facilityLevels: {
          battingCage: num(match['타격장Lv'], team.facilityLevels.battingCage),
          pitchingLab: num(match['투구랩Lv'], team.facilityLevels.pitchingLab),
          weightRoom: num(match['웨이트Lv'], team.facilityLevels.weightRoom),
          medicalCenter: num(match['메디컬Lv'], team.facilityLevels.medicalCenter),
        },
        wins: num(match['승'], team.wins),
        draws: num(match['무'], team.draws),
        losses: num(match['패'], team.losses),
        runsScored: num(match['득점'], team.runsScored),
        runsAllowed: num(match['실점'], team.runsAllowed),
      };
    });
  }

  const nextPlayersMap: Record<string, Player[]> = { ...currentPlayersMap };
  const battersArr: Record<string, unknown>[] = Array.isArray(d.batters) ? d.batters : [];
  const pitchersArr: Record<string, unknown>[] = Array.isArray(d.pitchers) ? d.pitchers : [];

  let syncedPlayerCount = 0;

  if (battersArr.length > 0 || pitchersArr.length > 0) {
    const groupedByTeam: Record<string, Player[]> = {};
    nextTeams.forEach(t => { groupedByTeam[t.id] = []; });

    battersArr.forEach((row, idx) => {
      const team =
        findTeamByNameOrId(nextTeams, String(row['구단ID'] || row['구단명'] || '')) ||
        findTeamByNameOrId(nextTeams, String(meta.selectedTeamId || ''));
      if (!team) return;
      const pos = normalizePosition(String(row['포지션'] || 'DH'), 'BATTER');
      const tierRaw = String(row['군'] || row['1군/2군'] || '1군');
      const tier: 'FIRST_TEAM' | 'SECOND_TEAM' = tierRaw.includes('2') ? 'SECOND_TEAM' : 'FIRST_TEAM';
      const base = generatePlayer(team.id, 'BATTER', pos, tier, normalizePotential(row['잠재력']));
      const playerId = String(row['선수ID'] || '').trim() || `p_${team.id}_sheet_b_${idx}_${Date.now()}`;
      base.id = playerId;
      base.name = String(row['이름'] || row['선수명'] || base.name).trim();
      base.age = num(row['나이'], base.age);
      base.level = num(row['레벨'], base.level);
      if (base.batterStats) {
        base.batterStats = {
          ...base.batterStats,
          contact: Math.min(99, Math.max(1, num(row['컨택'], base.batterStats.contact))),
          power: Math.min(99, Math.max(1, num(row['파워'], base.batterStats.power))),
          eye: Math.min(99, Math.max(1, num(row['선구안'], base.batterStats.eye))),
          speed: Math.min(99, Math.max(1, num(row['주력'], base.batterStats.speed))),
          defense: Math.min(99, Math.max(1, num(row['수비'], base.batterStats.defense))),
          clutch: Math.min(99, Math.max(1, num(row['클러치'], base.batterStats.clutch))),
          games: num(row['경기'], 0),
          atBats: num(row['타석'], 0),
          hits: num(row['안타'], 0),
          doubles: num(row['2루타'], 0),
          triples: num(row['3루타'], 0),
          homeRuns: num(row['홈런'], 0),
          rbi: num(row['타점'], 0),
          runs: num(row['득점'], 0),
          walks: num(row['볼넷'], 0),
          strikeouts: num(row['삼진'], 0),
          stolenBases: num(row['도루'], 0),
        };
      }
      groupedByTeam[team.id].push(base);
      syncedPlayerCount += 1;
    });

    pitchersArr.forEach((row, idx) => {
      const team =
        findTeamByNameOrId(nextTeams, String(row['구단ID'] || row['구단명'] || '')) ||
        findTeamByNameOrId(nextTeams, String(meta.selectedTeamId || ''));
      if (!team) return;
      const pos = normalizePosition(String(row['보직'] || row['포지션'] || 'SP'), 'PITCHER');
      const tierRaw = String(row['군'] || row['1군/2군'] || '1군');
      const tier: 'FIRST_TEAM' | 'SECOND_TEAM' = tierRaw.includes('2') ? 'SECOND_TEAM' : 'FIRST_TEAM';
      const base = generatePlayer(team.id, 'PITCHER', pos, tier, normalizePotential(row['잠재력']));
      const playerId = String(row['선수ID'] || '').trim() || `p_${team.id}_sheet_p_${idx}_${Date.now()}`;
      base.id = playerId;
      base.name = String(row['이름'] || row['선수명'] || base.name).trim();
      base.age = num(row['나이'], base.age);
      base.level = num(row['레벨'], base.level);

      let ipOuts = num(row['이닝아웃'], -1);
      if (ipOuts < 0 && row['이닝'] !== undefined) {
        const ipParts = String(row['이닝']).split('.');
        ipOuts = (parseInt(ipParts[0], 10) || 0) * 3 + (parseInt(ipParts[1], 10) || 0);
      }
      if (ipOuts < 0) ipOuts = 0;

      if (base.pitcherStats) {
        base.pitcherStats = {
          ...base.pitcherStats,
          velocity: Math.min(165, Math.max(120, num(row['최고구속'], base.pitcherStats.velocity))),
          control: Math.min(99, Math.max(1, num(row['제구'], base.pitcherStats.control))),
          stuff: Math.min(99, Math.max(1, num(row['구위'], base.pitcherStats.stuff))),
          stamina: Math.min(99, Math.max(1, num(row['체력'], base.pitcherStats.stamina))),
          clutch: Math.min(99, Math.max(1, num(row['클러치'], base.pitcherStats.clutch))),
          games: num(row['경기'] ?? row['경기수'], 0),
          inningsOuts: ipOuts,
          wins: num(row['승'], 0),
          losses: num(row['패'], 0),
          saves: num(row['세이브'], 0),
          holds: num(row['홀드'], 0),
          strikeouts: num(row['탈삼진'], 0),
          hitsAllowed: num(row['피안타'], 0),
          walksAllowed: num(row['사사구'], 0),
          earnedRuns: num(row['자책점'], 0),
        };
      }
      groupedByTeam[team.id].push(base);
      syncedPlayerCount += 1;
    });

    Object.keys(groupedByTeam).forEach(tid => {
      if (groupedByTeam[tid].length > 0) {
        nextPlayersMap[tid] = groupedByTeam[tid];
      }
    });
  }

  let nextChampions: HistorySeason[] | undefined;
  if (Array.isArray(d.historicalChampions) && d.historicalChampions.length > 0) {
    nextChampions = d.historicalChampions
      .map((c: Record<string, unknown>) => ({
        seasonNumber: num(c['회차(시즌)'] ?? c['회차'], 0),
        champion: String(c['우승구단'] || '').trim(),
      }))
      .filter((c: HistorySeason) => c.seasonNumber > 0 && c.champion);
  }

  let nextMatches: MatchRecord[] | undefined;
  if (Array.isArray(d.matchHistory) && d.matchHistory.length > 0) {
    nextMatches = d.matchHistory
      .filter((m: Record<string, unknown>) => String(m['매치업'] || '').trim() && String(m['매치업']) !== '진행된 경기 없음')
      .map((m: Record<string, unknown>, idx: number) => ({
        id: `sheet_match_${idx}_${Date.now()}`,
        day: num(m['일자'], 1),
        seasonNumber: num(m['시즌'], meta.seasonNumber || 26),
        dateStr: new Date().toLocaleDateString('ko-KR'),
        awayTeamName: String(m['원정팀'] || ''),
        homeTeamName: String(m['홈팀'] || ''),
        awayScore: num(m['원정점수'], 0),
        homeScore: num(m['홈점수'], 0),
        result: m['결과'] === '승리' ? 'WIN' : m['결과'] === '패배' ? 'LOSS' : 'DRAW',
        winningTeamName: String(m['승리팀'] || ''),
        awayHits: num(m['원정안타'], 0),
        homeHits: num(m['홈안타'], 0),
        awayErrors: 0,
        homeErrors: 0,
        summary: String(m['경기요약'] || ''),
      }));
  }

  return {
    seasonNumber: meta.seasonNumber,
    currentDay: meta.currentDay,
    selectedTeamId: meta.selectedTeamId,
    teams: nextTeams,
    playersMap: nextPlayersMap,
    historicalChampions: nextChampions,
    matchHistory: nextMatches,
    tradeLogs: Array.isArray(d.tradeLogs) ? d.tradeLogs : undefined,
    summaryText: `${meta.seasonNumber || 26}회차 ${meta.currentDay || 1}일차 · 선수 ${syncedPlayerCount}명`,
  };
}

export async function fetchPayloadFromGoogleAppsScript(
  webhookUrl: string,
  currentTeams: Team[],
  currentPlayersMap: Record<string, Player[]>
): Promise<{ success: boolean; message: string; data?: PulledSheetSyncData }> {
  const check = validateWebhookUrl(webhookUrl);
  if (!check.valid) {
    return { success: false, message: check.reason || '올바른 Google Apps Script 웹앱 URL을 입력해주세요.' };
  }

  try {
    const res = await fetch(webhookUrl.trim(), { method: 'GET', redirect: 'follow' });
    if (!res.ok) {
      return { success: false, message: `HTTP 오류 (${res.status}): Apps Script 웹앱이 '모든 사용자(Anyone)'로 배포되었는지 확인해주세요.` };
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        message: 'Google 로그인 페이지가 반환되어 불러올 수 없습니다. 배포 시 액세스 권한을 "모든 사용자(Anyone)"로 설정했는지 확인해주세요.',
      };
    }

    if (json.status !== 'success' || !json.data) {
      return {
        success: false,
        message: json.message || 'Apps Script doGet()이 v2.1 양방향 데이터를 반환하지 않았습니다. 최신 Code.gs로 다시 배포해주세요.',
      };
    }

    const parsed = parseSheetDataPayload(json.data, currentTeams, currentPlayersMap);
    return {
      success: true,
      message: `구글 시트 동기화 완료! (${parsed.summaryText} 불러옴)`,
      data: parsed,
    };
  } catch (err) {
    const schoolHint = check.isSchoolDomain
      ? ' (학교/기관 계정은 외부 웹앱 접근을 차단할 수 있습니다. 아래 [시트 내 메뉴 방식]이나 [표 복사-붙여넣기]를 이용해보세요!)'
      : ' (배포 권한이 "모든 사용자(Anyone)"인지 확인하거나, 아래 [시트 내 메뉴 방식]을 이용해주세요.)';
    return {
      success: false,
      message: `불러오기 실패: ${err instanceof Error ? err.message : String(err)}${schoolHint}`,
    };
  }
}

// ---------- CSV / TSV 스프레드시트 직접 가져오기 파서 ----------
export interface ImportedPlayerRow {
  teamQuery: string;
  name: string;
  role: 'BATTER' | 'PITCHER';
  position: Position;
  tier: 'FIRST_TEAM' | 'SECOND_TEAM';
  age?: number;
  potential?: PotentialGrade;
  // Batter overrides
  contact?: number;
  power?: number;
  eye?: number;
  speed?: number;
  defense?: number;
  clutch?: number;
  games?: number;
  atBats?: number;
  hits?: number;
  homeRuns?: number;
  rbi?: number;
  stolenBases?: number;
  // Pitcher overrides
  velocity?: number;
  control?: number;
  stuff?: number;
  stamina?: number;
  inningsOuts?: number;
  wins?: number;
  losses?: number;
  saves?: number;
  holds?: number;
  strikeouts?: number;
  earnedRuns?: number;
}

export interface ParsedSpreadsheetResult {
  kind: 'PLAYERS' | 'JBL_LEAGUE_CSV' | 'UNKNOWN';
  players: ImportedPlayerRow[];
  detectedSeasonNumber?: number;
  detectedChampions?: HistorySeason[];
  teamUpdates?: Array<{ name: string; owner?: string; homeStadium?: string; foundedYear?: number; championships?: number }>;
  message: string;
}

function splitDelimitedLine(line: string, delimiter: '\t' | ','): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map(c => c.trim());
  }
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseSpreadsheetText(rawText: string, defaultTeamName: string): ParsedSpreadsheetResult {
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return { kind: 'UNKNOWN', players: [], message: '입력된 데이터가 비어 있습니다.' };
  }

  const delimiter: '\t' | ',' = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map(l => splitDelimitedLine(l, delimiter));

  // 1) JBL 원본 구단/회차 CSV 형식 감지
  const firstRowJoined = rows[0].join(' ');
  if (firstRowJoined.includes('구단명') && firstRowJoined.includes('소유주') && firstRowJoined.includes('우승수')) {
    const teamUpdates: Array<{ name: string; owner?: string; homeStadium?: string; foundedYear?: number; championships?: number }> = [];
    const champs: HistorySeason[] = [];
    let maxSeason = 26;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const col0 = (r[0] || '').trim();
      if (col0 && !col0.includes('회차') && !col0.includes('우승') && !col0.startsWith('#') && r[1]) {
        teamUpdates.push({
          name: col0,
          owner: (r[1] || '').trim(),
          homeStadium: (r[2] || '').trim(),
          foundedYear: num(r[3], 1),
          championships: num(r[4], 0),
        });
      }
      if (col0.includes('회차') && rows[i + 1]) {
        const champRow = rows[i + 1];
        for (let c = 1; c < r.length; c++) {
          const sNum = parseInt(String(r[c] || '').replace(/[^0-9]/g, ''), 10);
          if (!isNaN(sNum) && sNum > 0) {
            if (sNum > maxSeason) maxSeason = sNum;
            const cName = (champRow[c] || '').trim();
            if (cName) {
              champs.push({ seasonNumber: sNum, champion: cName });
            }
          }
        }
      }
    }

    return {
      kind: 'JBL_LEAGUE_CSV',
      players: [],
      detectedSeasonNumber: maxSeason,
      detectedChampions: champs.length > 0 ? champs : undefined,
      teamUpdates,
      message: `JBL 리그 구단(${teamUpdates.length}개) 및 회차(${maxSeason}회차, 역대 우승 ${champs.length}건) 데이터를 인식했습니다! (참고: 이 시트에는 선수 명단 행은 포함되어 있지 않습니다)`,
    };
  }

  // 2) 선수 명단 CSV / TSV 감지 (헤더 행 자동 탐색)
  let headerIdx = rows.findIndex(r =>
    r.some(cell => ['이름', '선수명', '선수이름', 'name', 'player'].includes(cell.toLowerCase()))
  );

  // 헤더가 없는 경우 기본 컬럼 순서: [구단명, 이름, 포지션] 또는 [이름, 포지션]
  const hasHeader = headerIdx !== -1;
  if (!hasHeader) headerIdx = 0;

  const headers = hasHeader ? rows[headerIdx].map(h => h.trim().toLowerCase()) : [];
  const dataRows = hasHeader ? rows.slice(headerIdx + 1) : rows;

  const findCol = (aliases: string[]): number => {
    if (!hasHeader) return -1;
    return headers.findIndex(h => aliases.some(a => h === a || h.includes(a)));
  };

  const cTeam = findCol(['구단명', '구단', '팀명', '팀', 'team']);
  const cName = findCol(['선수명', '선수이름', '이름', 'name', 'player']);
  const cRole = findCol(['역할', '구분', '투타', 'role']);
  const cPos = findCol(['포지션', '보직', 'position', 'pos']);
  const cTier = findCol(['1군/2군', '군', '등록', 'tier']);
  const cAge = findCol(['나이', 'age']);
  const cPot = findCol(['잠재력', '등급', 'potential']);

  const cContact = findCol(['컨택', 'contact']);
  const cPower = findCol(['파워', '장타', 'power']);
  const cEye = findCol(['선구안', '선구', 'eye']);
  const cSpeed = findCol(['주력', '스피드', 'speed']);
  const cDefense = findCol(['수비', 'defense']);
  const cClutch = findCol(['클러치', 'clutch']);

  const cVelocity = findCol(['최고구속', '구속', 'velocity']);
  const cControl = findCol(['제구', 'control']);
  const cStuff = findCol(['구위', 'stuff']);
  const cStamina = findCol(['체력', '스태미너', 'stamina']);

  const cGames = findCol(['경기수', '경기', 'games']);
  const cAB = findCol(['타석', '타수', 'atbats']);
  const cHits = findCol(['안타', 'hits']);
  const cHR = findCol(['홈런', 'hr']);
  const cRBI = findCol(['타점', 'rbi']);
  const cSB = findCol(['도루', 'sb']);

  const cIP = findCol(['이닝', 'ip']);
  const cWins = findCol(['승', 'wins']);
  const cLosses = findCol(['패', 'losses']);
  const cSaves = findCol(['세이브', 'saves']);
  const cHolds = findCol(['홀드', 'holds']);
  const cSO = findCol(['탈삼진', '삼진', 'strikeouts']);
  const cER = findCol(['자책점', '자책', 'er']);

  const players: ImportedPlayerRow[] = [];

  dataRows.forEach(r => {
    let rawName = cName >= 0 ? r[cName] : (r.length >= 2 && !hasHeader ? r[1] : r[0]);
    let rawTeam = cTeam >= 0 ? r[cTeam] : (!hasHeader && r.length >= 3 ? r[0] : defaultTeamName);
    let rawPos = cPos >= 0 ? r[cPos] : (!hasHeader && r.length >= 3 ? r[2] : !hasHeader && r.length === 2 ? r[1] : 'DH');

    // 헤더 없고 2열이 팀명이 아니라 포지션인 경우 처리
    if (!hasHeader && r.length >= 2 && !cName) {
      if (['SP', 'RP', 'CP', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', '투수', '포수', '타자', '내야', '외야'].some(k => r[1].includes(k))) {
        rawName = r[0];
        rawPos = r[1];
        rawTeam = defaultTeamName;
      }
    }

    const cleanName = (rawName || '').trim();
    if (!cleanName || cleanName.startsWith('#')) return;

    const rawRoleStr = cRole >= 0 ? (r[cRole] || '').trim() : '';
    const posStr = (rawPos || '').trim().toUpperCase();
    const isPitcherByPos = ['SP', 'RP', 'CP', 'P'].includes(posStr) || posStr.includes('투수') || posStr.includes('선발') || posStr.includes('불펜') || posStr.includes('마무리') || posStr.includes('계투');
    const isPitcherByRole = rawRoleStr.includes('투') || rawRoleStr.toUpperCase() === 'PITCHER';
    const isPitcherByStats = cVelocity >= 0 && Boolean(r[cVelocity]);
    const role: 'BATTER' | 'PITCHER' = isPitcherByRole || isPitcherByPos || isPitcherByStats ? 'PITCHER' : 'BATTER';
    const position = normalizePosition(rawPos || '', role);

    const tierRaw = cTier >= 0 ? (r[cTier] || '') : '';
    const tier: 'FIRST_TEAM' | 'SECOND_TEAM' = tierRaw.includes('2') ? 'SECOND_TEAM' : 'FIRST_TEAM';

    let ipOuts: number | undefined;
    if (cIP >= 0 && r[cIP]) {
      const parts = String(r[cIP]).split('.');
      ipOuts = (parseInt(parts[0], 10) || 0) * 3 + (parseInt(parts[1], 10) || 0);
    }

    players.push({
      teamQuery: (rawTeam || defaultTeamName).trim(),
      name: cleanName,
      role,
      position,
      tier,
      age: cAge >= 0 && r[cAge] ? num(r[cAge]) : undefined,
      potential: cPot >= 0 && r[cPot] ? normalizePotential(r[cPot]) : undefined,
      contact: cContact >= 0 && r[cContact] ? num(r[cContact]) : undefined,
      power: cPower >= 0 && r[cPower] ? num(r[cPower]) : undefined,
      eye: cEye >= 0 && r[cEye] ? num(r[cEye]) : undefined,
      speed: cSpeed >= 0 && r[cSpeed] ? num(r[cSpeed]) : undefined,
      defense: cDefense >= 0 && r[cDefense] ? num(r[cDefense]) : undefined,
      clutch: cClutch >= 0 && r[cClutch] ? num(r[cClutch]) : undefined,
      velocity: cVelocity >= 0 && r[cVelocity] ? num(r[cVelocity]) : undefined,
      control: cControl >= 0 && r[cControl] ? num(r[cControl]) : undefined,
      stuff: cStuff >= 0 && r[cStuff] ? num(r[cStuff]) : undefined,
      stamina: cStamina >= 0 && r[cStamina] ? num(r[cStamina]) : undefined,
      games: cGames >= 0 && r[cGames] ? num(r[cGames]) : undefined,
      atBats: cAB >= 0 && r[cAB] ? num(r[cAB]) : undefined,
      hits: cHits >= 0 && r[cHits] ? num(r[cHits]) : undefined,
      homeRuns: cHR >= 0 && r[cHR] ? num(r[cHR]) : undefined,
      rbi: cRBI >= 0 && r[cRBI] ? num(r[cRBI]) : undefined,
      stolenBases: cSB >= 0 && r[cSB] ? num(r[cSB]) : undefined,
      inningsOuts: ipOuts,
      wins: cWins >= 0 && r[cWins] ? num(r[cWins]) : undefined,
      losses: cLosses >= 0 && r[cLosses] ? num(r[cLosses]) : undefined,
      saves: cSaves >= 0 && r[cSaves] ? num(r[cSaves]) : undefined,
      holds: cHolds >= 0 && r[cHolds] ? num(r[cHolds]) : undefined,
      strikeouts: cSO >= 0 && r[cSO] ? num(r[cSO]) : undefined,
      earnedRuns: cER >= 0 && r[cER] ? num(r[cER]) : undefined,
    });
  });

  if (players.length === 0) {
    return { kind: 'UNKNOWN', players: [], message: '인식할 수 있는 선수 행이 없습니다. 헤더(구단명, 이름, 포지션 등)를 확인해주세요.' };
  }

  return {
    kind: 'PLAYERS',
    players,
    message: `총 ${players.length}명의 선수 데이터(이름·포지션·스탯)를 인식했습니다.`,
  };
}

export function applyImportedPlayersToMap(
  currentMap: Record<string, Player[]>,
  teams: Team[],
  defaultTeamId: string,
  imported: ImportedPlayerRow[],
  mode: 'SYNC_AND_ADD' | 'APPEND' | 'REPLACE_TEAMS'
): { nextMap: Record<string, Player[]>; updatedCount: number; addedCount: number } {
  const nextMap: Record<string, Player[]> = {};
  Object.keys(currentMap).forEach(k => {
    nextMap[k] = [...currentMap[k]];
  });

  // REPLACE_TEAMS 모드면, 업로드된 팀들의 기존 로스터를 먼저 비움
  if (mode === 'REPLACE_TEAMS') {
    const touchedTeamIds = new Set<string>();
    imported.forEach(row => {
      const team = findTeamByNameOrId(teams, row.teamQuery) || teams.find(t => t.id === defaultTeamId);
      if (team) touchedTeamIds.add(team.id);
    });
    touchedTeamIds.forEach(tid => {
      nextMap[tid] = [];
    });
  }

  let updatedCount = 0;
  let addedCount = 0;

  const mergeFields = (base: Player, row: ImportedPlayerRow): Player => {
    const p: Player = {
      ...base,
      name: row.name,
      role: row.role,
      primaryPosition: row.position,
      tier: row.tier,
      age: row.age ?? base.age,
      potential: row.potential ?? base.potential,
    };

    if (row.role === 'BATTER') {
      const baseBs = base.batterStats || generatePlayer(base.teamId, 'BATTER', row.position, row.tier, p.potential).batterStats!;
      p.batterStats = {
        ...baseBs,
        contact: row.contact ?? baseBs.contact,
        power: row.power ?? baseBs.power,
        eye: row.eye ?? baseBs.eye,
        speed: row.speed ?? baseBs.speed,
        defense: row.defense ?? baseBs.defense,
        clutch: row.clutch ?? baseBs.clutch,
        games: row.games ?? baseBs.games,
        atBats: row.atBats ?? baseBs.atBats,
        hits: row.hits ?? baseBs.hits,
        homeRuns: row.homeRuns ?? baseBs.homeRuns,
        rbi: row.rbi ?? baseBs.rbi,
        stolenBases: row.stolenBases ?? baseBs.stolenBases,
      };
      delete p.pitcherStats;
    } else {
      const basePs = base.pitcherStats || generatePlayer(base.teamId, 'PITCHER', row.position, row.tier, p.potential).pitcherStats!;
      p.pitcherStats = {
        ...basePs,
        velocity: row.velocity ?? basePs.velocity,
        control: row.control ?? basePs.control,
        stuff: row.stuff ?? basePs.stuff,
        stamina: row.stamina ?? basePs.stamina,
        clutch: row.clutch ?? basePs.clutch,
        games: row.games ?? basePs.games,
        inningsOuts: row.inningsOuts ?? basePs.inningsOuts,
        wins: row.wins ?? basePs.wins,
        losses: row.losses ?? basePs.losses,
        saves: row.saves ?? basePs.saves,
        holds: row.holds ?? basePs.holds,
        strikeouts: row.strikeouts ?? basePs.strikeouts,
        earnedRuns: row.earnedRuns ?? basePs.earnedRuns,
      };
      delete p.batterStats;
    }

    return p;
  };

  imported.forEach((row, idx) => {
    const team = findTeamByNameOrId(teams, row.teamQuery) || teams.find(t => t.id === defaultTeamId) || teams[0];
    const roster = nextMap[team.id] || [];

    if (mode === 'SYNC_AND_ADD') {
      // 1) 이름 일치 선수 찾기
      const matchIdx = roster.findIndex(p => p.name === row.name);
      if (matchIdx >= 0) {
        roster[matchIdx] = mergeFields(roster[matchIdx], row);
        updatedCount += 1;
        nextMap[team.id] = roster;
        return;
      }
    }

    const fresh = generatePlayer(team.id, row.role, row.position, row.tier, row.potential);
    fresh.id = `p_${team.id}_imp_${Date.now()}_${idx}`;
    roster.push(mergeFields(fresh, row));
    addedCount += 1;
    nextMap[team.id] = roster;
  });

  return { nextMap, updatedCount, addedCount };
}

// ---------- 다운로드 헬퍼들 ----------
export function downloadJsonBackup(payload: GameExportPayload) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `JBL_League_Season_${payload.seasonNumber}_Backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function downloadBattersCsv(roster: Player[], fileName = 'JBL_선수단_타자명단.csv') {
  const batters = roster.filter(p => p.role === 'BATTER');
  const headers = ['이름,포지션,1군/2군,나이,잠재력,컨택,파워,선구안,주력,수비,타석,안타,홈런,타점,득점,도루,타율,출루율,장타율,OPS'];
  const lines = batters.map(b => {
    const s = b.batterStats || { atBats: 0, hits: 0, homeRuns: 0, doubles: 0, triples: 0, rbi: 0, runs: 0, walks: 0, stolenBases: 0, contact: 0, power: 0, eye: 0, speed: 0, defense: 0 };
    const ab = s.atBats || 0;
    const h = s.hits || 0;
    const hr = s.homeRuns || 0;
    const bb = s.walks || 0;
    const avg = ab > 0 ? (h / ab).toFixed(3) : '.000';
    const obp = (ab + bb) > 0 ? ((h + bb) / (ab + bb)).toFixed(3) : '.000';
    const slg = ab > 0 ? ((h + hr * 3) / ab).toFixed(3) : '.000';
    const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);
    return `"${b.name}","${b.primaryPosition}","${b.tier === 'FIRST_TEAM' ? '1군' : '2군'}",${b.age},"${b.potential}",${s.contact},${s.power},${s.eye},${s.speed},${s.defense},${ab},${h},${hr},${s.rbi},${s.runs},${s.stolenBases},${avg},${obp},${slg},${ops}`;
  });

  const csvContent = '\uFEFF' + [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadAllBattersCsv(teams: Team[], allPlayers: Record<string, Player[]>) {
  const headers = ['구단명,이름,포지션,1군/2군,나이,잠재력,컨택,파워,선구안,주력,수비,경기,타석,안타,홈런,타점,득점,도루,타율,OPS'];
  const lines: string[] = [];
  teams.forEach(team => {
    const batters = (allPlayers[team.id] || []).filter(p => p.role === 'BATTER');
    batters.forEach(b => {
      const s = b.batterStats || { games: 0, atBats: 0, hits: 0, homeRuns: 0, rbi: 0, runs: 0, walks: 0, stolenBases: 0, contact: 0, power: 0, eye: 0, speed: 0, defense: 0 };
      const ab = s.atBats || 0;
      const h = s.hits || 0;
      const hr = s.homeRuns || 0;
      const bb = s.walks || 0;
      const avg = ab > 0 ? (h / ab).toFixed(3) : '.000';
      const obp = (ab + bb) > 0 ? ((h + bb) / (ab + bb)).toFixed(3) : '.000';
      const slg = ab > 0 ? ((h + hr * 3) / ab).toFixed(3) : '.000';
      const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);
      lines.push(`"${team.name}","${b.name}","${b.primaryPosition}","${b.tier === 'FIRST_TEAM' ? '1군' : '2군'}",${b.age},"${b.potential}",${s.contact},${s.power},${s.eye},${s.speed},${s.defense},${s.games},${ab},${h},${hr},${s.rbi},${s.runs},${s.stolenBases},${avg},${ops}`);
    });
  });

  const csvContent = '\uFEFF' + [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `JBL_전체구단_타자통합명단.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPitchersCsv(roster: Player[], fileName = 'JBL_선수단_투수명단.csv') {
  const pitchers = roster.filter(p => p.role === 'PITCHER');
  const headers = ['이름,보직,1군/2군,나이,잠재력,최고구속,제구,구위,체력,경기수,이닝,승,패,세이브,홀드,탈삼진,피안타,사사구,자책점,평균자책(ERA),WHIP'];
  const lines = pitchers.map(p => {
    const s = p.pitcherStats || { velocity: 0, control: 0, stuff: 0, stamina: 0, games: 0, inningsOuts: 0, wins: 0, losses: 0, saves: 0, holds: 0, strikeouts: 0, hitsAllowed: 0, walksAllowed: 0, earnedRuns: 0 };
    const ipOuts = s.inningsOuts || 0;
    const fullIp = Math.floor(ipOuts / 3);
    const partIp = ipOuts % 3;
    const ipStr = fullIp + (partIp > 0 ? '.' + partIp : '');
    const floatIp = ipOuts / 3;
    const era = floatIp > 0 ? ((s.earnedRuns * 9) / floatIp).toFixed(2) : '0.00';
    const whip = floatIp > 0 ? ((s.hitsAllowed + s.walksAllowed) / floatIp).toFixed(2) : '0.00';
    return `"${p.name}","${p.primaryPosition}","${p.tier === 'FIRST_TEAM' ? '1군' : '2군'}",${p.age},"${p.potential}",${s.velocity},${s.control},${s.stuff},${s.stamina},${s.games},"${ipStr}",${s.wins},${s.losses},${s.saves},${s.holds},${s.strikeouts},${s.hitsAllowed},${s.walksAllowed},${s.earnedRuns},${era},${whip}`;
  });

  const csvContent = '\uFEFF' + [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadAllPitchersCsv(teams: Team[], allPlayers: Record<string, Player[]>) {
  const headers = ['구단명,이름,보직,1군/2군,나이,잠재력,최고구속,제구,구위,체력,경기,이닝,승,패,세이브,홀드,탈삼진,피안타,사사구,자책점,ERA,WHIP'];
  const lines: string[] = [];
  teams.forEach(team => {
    const pitchers = (allPlayers[team.id] || []).filter(p => p.role === 'PITCHER');
    pitchers.forEach(p => {
      const s = p.pitcherStats || { velocity: 0, control: 0, stuff: 0, stamina: 0, games: 0, inningsOuts: 0, wins: 0, losses: 0, saves: 0, holds: 0, strikeouts: 0, hitsAllowed: 0, walksAllowed: 0, earnedRuns: 0 };
      const ipOuts = s.inningsOuts || 0;
      const fullIp = Math.floor(ipOuts / 3);
      const partIp = ipOuts % 3;
      const ipStr = fullIp + (partIp > 0 ? '.' + partIp : '');
      const floatIp = ipOuts / 3;
      const era = floatIp > 0 ? ((s.earnedRuns * 9) / floatIp).toFixed(2) : '0.00';
      const whip = floatIp > 0 ? ((s.hitsAllowed + s.walksAllowed) / floatIp).toFixed(2) : '0.00';
      lines.push(`"${team.name}","${p.name}","${p.primaryPosition}","${p.tier === 'FIRST_TEAM' ? '1군' : '2군'}",${p.age},"${p.potential}",${s.velocity},${s.control},${s.stuff},${s.stamina},${s.games},"${ipStr}",${s.wins},${s.losses},${s.saves},${s.holds},${s.strikeouts},${s.hitsAllowed},${s.walksAllowed},${s.earnedRuns},${era},${whip}`);
    });
  });

  const csvContent = '\uFEFF' + [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `JBL_전체구단_투수통합명단.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
