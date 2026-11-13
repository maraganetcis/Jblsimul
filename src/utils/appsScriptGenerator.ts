/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Team, Player, HistorySeason, MatchRecord } from '../types/baseball';

export interface GameExportPayload {
  exportDate: string;
  seasonNumber: number;
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
 * JBL 프로야구단 매니저 (JBL Baseball Manager) - Google Sheets 동기화 스크립트
 * ==============================================================================
 * [설치 및 배포 방법 (30초 소요)]
 * 1. 구글 스프레드시트(Google Sheets)를 새로 만듭니다.
 * 2. 상단 메뉴에서 [확장 프로그램] -> [Apps Script]를 클릭합니다.
 * 3. 편집기에 적힌 기존 코드를 모두 지우고, 이 코드 전체를 복사하여 붙여넣습니다.
 * 4. 우측 상단의 [배포] -> [새 배포]를 클릭합니다.
 * 5. 유형 선택(톱니바퀴 아이콘)에서 [웹 앱]을 선택합니다.
 *    - 설명: JBL Baseball Sync
 *    - 다음 사용자 권한으로 실행: 나(내 계정)
 *    - 액세스 권한이 있는 사용자: [모든 사용자 (Anyone)] 로 설정 (중요!)
 * 6. [배포] 버튼을 누르고 생성된 '웹 앱 URL (https://script.google.com/macros/s/.../exec)'을 복사합니다.
 * 7. 게임 내 [구글 시트 연동] 메뉴의 Webhook URL 칸에 붙여넣고 [즉시 동기화]를 누르면 끝!
 * ==============================================================================
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "JBL 프로야구단 스프레드시트 연동 웹앱이 정상 작동 중입니다!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. [구단정보] 시트 동기화
    syncTeamInfoSheet(ss, payload);

    // 2. [선수단_타자] 시트 동기화
    syncBatterSheet(ss, payload);

    // 3. [선수단_투수] 시트 동기화
    syncPitcherSheet(ss, payload);

    // 4. [리그순위표] 시트 동기화
    syncStandingsSheet(ss, payload);

    // 5. [역대_우승족보] 시트 동기화
    syncHistorySheet(ss, payload);

    // 6. [경기기록_박스스코어] 시트 동기화
    syncMatchesSheet(ss, payload);

    // 7. [트레이드_드래프트_이력] 시트 동기화
    syncActivitySheet(ss, payload);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "성공적으로 구글 시트의 모든 탭이 최신 게임 데이터로 갱신되었습니다!",
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
  range.setBackground(bgColor || "#1E293B")
       .setFontColor("#FFFFFF")
       .setFontWeight("bold")
       .setHorizontalAlignment("center");
}

function syncTeamInfoSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "1.구단정보");
  var headers = ["항목", "내용"];
  var team = p.userTeam;
  var rows = [
    headers,
    ["구단명", team.name],
    ["소유주 (모기업)", team.owner],
    ["홈구장 (연고지)", team.homeStadium],
    ["창단년도", team.foundedYear + "년"],
    ["역대 우승 횟수", team.championships + "회"],
    ["구단 보유 자금", (team.budget || 0).toLocaleString() + " 만원"],
    ["현재 시즌", p.seasonNumber + "회차 시즌"],
    ["시즌 성적", team.wins + "승 " + team.draws + "무 " + team.losses + "패"],
    ["승률", (team.wins + team.losses > 0 ? (team.wins / (team.wins + team.losses)).toFixed(3) : ".000")],
    ["동기화 일시", p.exportDate]
  ];
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  styleHeaderRow(sheet, 2, "#1E3A8A");
  sheet.autoResizeColumns(1, 2);
}

function syncBatterSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "2.선수단_타자");
  var headers = ["이름", "포지션", "군", "나이", "잠재력", "컨택", "파워", "선구안", "주력", "수비", "타석", "안타", "홈런", "타점", "득점", "도루", "타율", "출루율", "장타율", "OPS"];
  var rows = [headers];

  var batters = (p.userRoster || []).filter(function(x) { return x.role === "BATTER"; });
  batters.forEach(function(b) {
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
      b.name,
      b.primaryPosition,
      b.tier === "FIRST_TEAM" ? "1군" : "2군",
      b.age,
      b.potential,
      s.contact || 0,
      s.power || 0,
      s.eye || 0,
      s.speed || 0,
      s.defense || 0,
      ab,
      h,
      hr,
      s.rbi || 0,
      s.runs || 0,
      s.stolenBases || 0,
      avg,
      obp,
      slg,
      ops
    ]);
  });

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    styleHeaderRow(sheet, headers.length, "#0F766E");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function syncPitcherSheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "3.선수단_투수");
  var headers = ["이름", "보직", "군", "나이", "잠재력", "최고구속", "제구", "구위", "체력", "경기수", "이닝", "승", "패", "세이브", "홀드", "탈삼진", "피안타", "사사구", "자책점", "방어율(ERA)", "WHIP"];
  var rows = [headers];

  var pitchers = (p.userRoster || []).filter(function(x) { return x.role === "PITCHER"; });
  pitchers.forEach(function(pc) {
    var s = pc.pitcherStats || {};
    var ipOuts = s.inningsOuts || 0;
    var fullIp = Math.floor(ipOuts / 3);
    var partIp = ipOuts % 3;
    var ipStr = fullIp + (partIp > 0 ? "." + partIp : "");
    var floatIp = ipOuts / 3;
    var era = floatIp > 0 ? ((s.earnedRuns || 0) * 9 / floatIp).toFixed(2) : "0.00";
    var whip = floatIp > 0 ? (((s.hitsAllowed || 0) + (s.walksAllowed || 0)) / floatIp).toFixed(2) : "0.00";

    rows.push([
      pc.name,
      pc.primaryPosition,
      pc.tier === "FIRST_TEAM" ? "1군" : "2군",
      pc.age,
      pc.potential,
      (s.velocity || 0) + "km/h",
      s.control || 0,
      s.stuff || 0,
      s.stamina || 0,
      s.games || 0,
      ipStr,
      s.wins || 0,
      s.losses || 0,
      s.saves || 0,
      s.holds || 0,
      s.strikeouts || 0,
      s.hitsAllowed || 0,
      s.walksAllowed || 0,
      s.earnedRuns || 0,
      era,
      whip
    ]);
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
    rows.push([
      idx + 1,
      t.name,
      games,
      t.wins,
      t.draws,
      t.losses,
      winRate,
      t.runsScored || 0,
      t.runsAllowed || 0,
      (t.runsScored || 0) - (t.runsAllowed || 0)
    ]);
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
    rows.push([h.seasonNumber + "회차", h.champion]);
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
      m.day + "일차",
      m.seasonNumber + "회차",
      m.awayTeamName + " vs " + m.homeTeamName,
      m.awayTeamName,
      m.awayScore,
      m.homeTeamName,
      m.homeScore,
      m.result === "WIN" ? "승리" : m.result === "LOSS" ? "패배" : "무승부",
      m.winningTeamName,
      m.awayHits,
      m.homeHits,
      m.summary || ""
    ]);
  });

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  } else {
    rows.push(["안내", "-", "아직 진행된 경기 기록이 없습니다.", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  }
  styleHeaderRow(sheet, headers.length, "#0369A1");
  sheet.autoResizeColumns(1, headers.length);
}

function syncActivitySheet(ss, p) {
  var sheet = getOrCreateSheet(ss, "7.트레이드_드래프트_이력");
  var headers = ["유형", "일자/라운드", "상세 내용"];
  var rows = [headers];

  (p.tradeLogs || []).forEach(function(t) {
    rows.push(["트레이드", t.date, t.description]);
  });

  (p.draftLogs || []).forEach(function(d) {
    rows.push(["신인 드래프트", d.round + "라운드 (" + d.pickNumber + "순위)", d.teamName + " -> " + d.playerName + " (" + d.position + ", " + d.school + ")"]);
  });

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  } else {
    rows.push(["안내", "-", "아직 진행된 트레이드 또는 드래프트 기록이 없습니다."]);
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  }
  styleHeaderRow(sheet, headers.length, "#C2410C");
  sheet.autoResizeColumns(1, headers.length);
}
`;

export async function sendPayloadToGoogleAppsScript(webhookUrl: string, payload: GameExportPayload): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: '올바른 Google Apps Script 웹앱 URL을 입력해주세요.' };
  }

  try {
    // Google Apps Script redirects with 302, mode: 'no-cors' allows submission without CORS error
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });

    return {
      success: true,
      message: 'Google Apps Script 웹 앱으로 데이터가 성공적으로 전송되었습니다! 스프레드시트를 새로고침하여 확인해보세요.',
    };
  } catch (err) {
    return {
      success: false,
      message: `전송 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function downloadJsonBackup(payload: GameExportPayload) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `JBL_League_Season_${payload.seasonNumber}_Backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function downloadBattersCsv(roster: Player[]) {
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
  a.download = `JBL_선수단_타자명단.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPitchersCsv(roster: Player[]) {
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
    return `"${p.name}","${p.primaryPosition}","${p.tier === 'FIRST_TEAM' ? '1군' : '2군'}",${p.age},"${p.potential}","${s.velocity}km/h",${s.control},${s.stuff},${s.stamina},${s.games},"${ipStr}",${s.wins},${s.losses},${s.saves},${s.holds},${s.strikeouts},${s.hitsAllowed},${s.walksAllowed},${s.earnedRuns},${era},${whip}`;
  });

  const csvContent = '\uFEFF' + [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `JBL_선수단_투수명단.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
