// date-parser.js — Flexible genealogy date interpreter
// Parses free-text date input into normalized GEDCOM-style dates
// and friendly display strings.

var MONTHS = {
  'january': 'JAN', 'jan': 'JAN', '01': 'JAN', '1': 'JAN',
  'february': 'FEB', 'feb': 'FEB', '02': 'FEB', '2': 'FEB',
  'march': 'MAR', 'mar': 'MAR', '03': 'MAR', '3': 'MAR',
  'april': 'APR', 'apr': 'APR', '04': 'APR', '4': 'APR',
  'may': 'MAY', '05': 'MAY', '5': 'MAY',
  'june': 'JUN', 'jun': 'JUN', '06': 'JUN', '6': 'JUN',
  'july': 'JUL', 'jul': 'JUL', '07': 'JUL', '7': 'JUL',
  'august': 'AUG', 'aug': 'AUG', '08': 'AUG', '8': 'AUG',
  'september': 'SEP', 'sep': 'SEP', 'sept': 'SEP', '09': 'SEP', '9': 'SEP',
  'october': 'OCT', 'oct': 'OCT', '10': 'OCT',
  'november': 'NOV', 'nov': 'NOV', '11': 'NOV',
  'december': 'DEC', 'dec': 'DEC', '12': 'DEC'
};

var MONTH_DISPLAY = {
  'JAN': 'January', 'FEB': 'February', 'MAR': 'March', 'APR': 'April',
  'MAY': 'May', 'JUN': 'June', 'JUL': 'July', 'AUG': 'August',
  'SEP': 'September', 'OCT': 'October', 'NOV': 'November', 'DEC': 'December'
};

var QUALIFIERS = [
  { patterns: ['about', 'abt', 'abt.', 'circa', 'ca', 'ca.', 'around', 'approximately', 'approx', 'approx.', '~'], prefix: 'ABT' },
  { patterns: ['before', 'bef', 'bef.', 'prior to', 'by'], prefix: 'BEF' },
  { patterns: ['after', 'aft', 'aft.', 'from', 'since'], prefix: 'AFT' },
  { patterns: ['between', 'bet', 'bet.', 'from'], prefix: 'BET' }
];

function parseGenealogyDate(input) {
  if (!input || typeof input !== 'string') return { normalized: '', display: '', qualifier: '', raw: input || '' };

  var raw = input.trim();
  if (!raw) return { normalized: '', display: '', qualifier: '', raw: '' };

  var text = raw.toLowerCase().replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim();
  var qualifier = '';
  var isBetween = false;
  var betweenEnd = '';

  // Check for "between X and Y"
  var betMatch = text.match(/^(?:between|bet\.?)\s+(.+?)\s+(?:and|&|-)\s+(.+)$/i);
  if (betMatch) {
    qualifier = 'BET';
    isBetween = true;
    text = betMatch[1].trim();
    betweenEnd = betMatch[2].trim();
  }

  // Check for qualifier prefixes
  if (!qualifier) {
    for (var qi = 0; qi < QUALIFIERS.length; qi++) {
      var q = QUALIFIERS[qi];
      for (var pi = 0; pi < q.patterns.length; pi++) {
        var pat = q.patterns[pi];
        if (text === pat) {
          // Just the qualifier with no date
          continue;
        }
        if (pat === '~' && text.charAt(0) === '~') {
          qualifier = q.prefix;
          text = text.substring(1).trim();
          break;
        }
        if (text.indexOf(pat + ' ') === 0) {
          qualifier = q.prefix;
          text = text.substring(pat.length).trim();
          break;
        }
      }
      if (qualifier) break;
    }
  }

  var datePart = parseDatePart(text);

  // Handle between end date
  var endPart = null;
  if (isBetween && betweenEnd) {
    endPart = parseDatePart(betweenEnd);
  }

  // Build normalized string (GEDCOM format)
  var normalized = '';
  if (qualifier === 'BET' && endPart) {
    normalized = 'BET ' + datePart.gedcom + ' AND ' + endPart.gedcom;
  } else if (qualifier) {
    normalized = qualifier + ' ' + datePart.gedcom;
  } else {
    normalized = datePart.gedcom;
  }

  // Build display string
  var display = '';
  if (qualifier === 'ABT') display = 'About ' + datePart.display;
  else if (qualifier === 'BEF') display = 'Before ' + datePart.display;
  else if (qualifier === 'AFT') display = 'After ' + datePart.display;
  else if (qualifier === 'BET' && endPart) display = 'Between ' + datePart.display + ' and ' + endPart.display;
  else display = datePart.display;

  return {
    normalized: normalized,
    display: display,
    qualifier: qualifier,
    raw: raw
  };
}

function parseDatePart(text) {
  text = text.replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();

  // Try: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  var slashMatch = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (slashMatch) {
    var day = parseInt(slashMatch[1]);
    var monthNum = slashMatch[2];
    var year = normalizeYear(slashMatch[3]);
    var monthCode = MONTHS[monthNum] || MONTHS[String(parseInt(monthNum))];
    if (monthCode && day >= 1 && day <= 31) {
      return {
        gedcom: day + ' ' + monthCode + ' ' + year,
        display: MONTH_DISPLAY[monthCode] + ' ' + day + ', ' + year
      };
    }
  }

  // Try: YYYY-MM-DD (ISO format)
  var isoMatch = text.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (isoMatch) {
    var year = isoMatch[1];
    var monthNum = isoMatch[2];
    var day = parseInt(isoMatch[3]);
    var monthCode = MONTHS[monthNum] || MONTHS[String(parseInt(monthNum))];
    if (monthCode && day >= 1 && day <= 31) {
      return {
        gedcom: day + ' ' + monthCode + ' ' + year,
        display: MONTH_DISPLAY[monthCode] + ' ' + day + ', ' + year
      };
    }
  }

  // Try: "Month DD YYYY" or "DD Month YYYY"
  var parts = text.split(/\s+/);

  if (parts.length === 3) {
    // "January 5 1892" or "jan 5 1892"
    var m = MONTHS[parts[0].toLowerCase()];
    if (m && parts[1].match(/^\d{1,2}$/) && parts[2].match(/^\d{2,4}$/)) {
      var d = parseInt(parts[1]);
      var y = normalizeYear(parts[2]);
      return { gedcom: d + ' ' + m + ' ' + y, display: MONTH_DISPLAY[m] + ' ' + d + ', ' + y };
    }

    // "5 January 1892" or "5 jan 1892"
    m = MONTHS[parts[1].toLowerCase()];
    if (m && parts[0].match(/^\d{1,2}$/) && parts[2].match(/^\d{2,4}$/)) {
      var d = parseInt(parts[0]);
      var y = normalizeYear(parts[2]);
      return { gedcom: d + ' ' + m + ' ' + y, display: MONTH_DISPLAY[m] + ' ' + d + ', ' + y };
    }
  }

  // Try: "Month YYYY" or "YYYY Month"
  if (parts.length === 2) {
    var m = MONTHS[parts[0].toLowerCase()];
    if (m && parts[1].match(/^\d{2,4}$/)) {
      var y = normalizeYear(parts[1]);
      return { gedcom: m + ' ' + y, display: MONTH_DISPLAY[m] + ' ' + y };
    }
    m = MONTHS[parts[1].toLowerCase()];
    if (m && parts[0].match(/^\d{2,4}$/)) {
      var y = normalizeYear(parts[0]);
      return { gedcom: m + ' ' + y, display: MONTH_DISPLAY[m] + ' ' + y };
    }
  }

  // Try: just a year "1892"
  if (text.match(/^\d{3,4}$/)) {
    return { gedcom: text, display: text };
  }

  // Already in GEDCOM format? (e.g. "5 JAN 1892", "ABT 1670")
  var gedMatch = text.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{3,4})$/i);
  if (gedMatch) {
    var d = parseInt(gedMatch[1]);
    var m = gedMatch[2].toUpperCase();
    var y = gedMatch[3];
    return { gedcom: d + ' ' + m + ' ' + y, display: MONTH_DISPLAY[m] + ' ' + d + ', ' + y };
  }

  // Month year in GEDCOM "JAN 1892"
  var gedMonthYear = text.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{3,4})$/i);
  if (gedMonthYear) {
    var m = gedMonthYear[1].toUpperCase();
    var y = gedMonthYear[2];
    return { gedcom: m + ' ' + y, display: MONTH_DISPLAY[m] + ' ' + y };
  }

  // Fallback: return as-is
  return { gedcom: text, display: text };
}

function normalizeYear(y) {
  if (y.length === 2) {
    var num = parseInt(y);
    // Assume 00-30 = 2000s, 31-99 = 1900s (genealogy skews old)
    return (num <= 30 ? '20' : '19') + y;
  }
  return y;
}

// Display a normalized GEDCOM date in friendly format
function displayDate(normalized) {
  if (!normalized) return '';
  var result = parseGenealogyDate(normalized);
  return result.display || normalized;
}