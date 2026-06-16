// ============================================================
// CONFIGURATION — Edit these values after setup
// ============================================================
//
// SETUP INSTRUCTIONS:
// 1. Go to script.google.com and open this project
// 2. Create a Google Calendar for the library cart:
//    - In Google Calendar, click "+" next to "Other calendars" → "Create new calendar"
//    - Name it "Library Cart" (or whatever you like)
//    - Go to its Settings → "Integrate calendar" and copy the Calendar ID
// 3. In Apps Script, go to Project Settings → Script Properties and add:
//    - LIBRARY_CART_ID  →  paste the calendar ID
//    (Optional additional carts: CART_A_ID, CART_B_ID, CART_C_ID)
// 4. Share each cart calendar with your domain:
//    - In Google Calendar, open the calendar's Settings → "Share with specific people"
//    - Add harfordchristian.org with "See all event details" permission
//    - This is required for the embedded calendar view to work
// 5. Deploy: Click "Deploy" → "New deployment" → Web app
//    - Execute as: "Me (your account)"
//    - Who has access: "Anyone in Harford Christian School"
//    - Click Deploy and copy the URL to share with staff
// ============================================================

var DOMAIN = 'harfordchristian.org';

// Time slot range (24-hour format, inclusive start, exclusive end)
var DAY_START_HOUR = 7;  // 7:00 AM
var DAY_END_HOUR = 16;   // up to 4:00 PM (last slot is 3–4 PM)

// ============================================================
// CART CONFIGURATION — loaded from Script Properties
// ============================================================

function getCartConfig() {
  var props = PropertiesService.getScriptProperties();
  var carts = {};

  var libId    = props.getProperty('LIBRARY_CART_ID');
  var mobileId = props.getProperty('MOBILE_CART_ID');
  var cartAId  = props.getProperty('CART_A_ID');
  var cartBId  = props.getProperty('CART_B_ID');
  var cartCId  = props.getProperty('CART_C_ID');

  if (libId)    carts['Library Cart'] = libId;
  if (mobileId) carts['Mobile Cart']  = mobileId;
  if (cartAId)  carts['Cart A']       = cartAId;
  if (cartBId)  carts['Cart B']       = cartBId;
  if (cartCId)  carts['Cart C']       = cartCId;

  return carts;
}

// ============================================================
// DOMAIN ENFORCEMENT
// ============================================================

function assertDomain() {
  var email = Session.getActiveUser().getEmail();
  if (!email || !email.endsWith('@' + DOMAIN)) {
    throw new Error('Access restricted to @' + DOMAIN + ' accounts.');
  }
  return email;
}

// ============================================================
// WEB APP ENTRY POINT
// ============================================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Library Cart Checkout — Harford Christian')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// SERVER-SIDE FUNCTIONS (called via google.script.run)
// ============================================================

/**
 * Returns the current user's display name and email.
 */
function getCurrentUser() {
  var email = assertDomain();
  var name = '';
  try {
    name = ContactsApp.getContact(email) ?
      ContactsApp.getContact(email).getFullName() : '';
  } catch (e) { /* ContactsApp may not be available */ }

  if (!name) {
    var prefix = email.split('@')[0];
    name = prefix.replace(/[._]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }
  return { email: email, name: name };
}

/**
 * Returns availability for all carts on a single date.
 * dateString: 'YYYY-MM-DD'
 */
function getAvailability(dateString) {
  var currentEmail = assertDomain();
  var carts = getCartConfig();
  return getEventsForDate(dateString, currentEmail, carts);
}

/**
 * Returns availability for all carts for an entire Mon–Fri week.
 * mondayDateString: 'YYYY-MM-DD' (must be a Monday)
 * Returns: [{ dateStr, dayLabel, data: { cartName: [events] } }, ...]
 */
function getWeekAvailability(mondayDateString) {
  var currentEmail = assertDomain();
  var carts = getCartConfig();
  var parts = mondayDateString.split('-');
  var monday = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var result = [];

  for (var d = 0; d < 5; d++) {
    var day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d);
    var dateStr = day.getFullYear() + '-' +
                  String(day.getMonth() + 1).padStart(2, '0') + '-' +
                  String(day.getDate()).padStart(2, '0');
    result.push({
      dateStr:  dateStr,
      dayLabel: dayNames[d] + ' ' + (day.getMonth() + 1) + '/' + day.getDate(),
      data:     getEventsForDate(dateStr, currentEmail, carts)
    });
  }
  return result;
}

/**
 * Creates a single reservation event on the specified cart's calendar.
 */
function createReservation(params) {
  var currentEmail = assertDomain();
  var carts = getCartConfig();
  var calId = carts[params.cartName];
  if (!calId) throw new Error('Unknown cart: ' + params.cartName);

  var parts = params.dateString.split('-');
  var startTime = new Date(parts[0], parts[1] - 1, parts[2], params.startHour, 0, 0);
  var endTime   = new Date(parts[0], parts[1] - 1, parts[2], params.endHour,   0, 0);
  var title = params.teacherName + (params.period ? ' — ' + params.period : '');
  var cal = CalendarApp.getCalendarById(calId);
  if (!cal) throw new Error('Could not access calendar for ' + params.cartName);

  cal.createEvent(title, startTime, endTime, {
    description: buildDescription('RESERVED', params.teacherName, currentEmail, params.period)
  });
}

/**
 * Creates a weekly recurring reservation series.
 * params: same as createReservation + recurrenceType ('weeks'|'date') + weeks|endDate
 */
function createRecurringReservation(params) {
  var currentEmail = assertDomain();
  var carts = getCartConfig();
  var calId = carts[params.cartName];
  if (!calId) throw new Error('Unknown cart: ' + params.cartName);

  var parts = params.dateString.split('-');
  var startTime = new Date(parts[0], parts[1] - 1, parts[2], params.startHour, 0, 0);
  var endTime   = new Date(parts[0], parts[1] - 1, parts[2], params.endHour,   0, 0);
  var title = params.teacherName + (params.period ? ' — ' + params.period : '');
  var cal = CalendarApp.getCalendarById(calId);
  if (!cal) throw new Error('Could not access calendar for ' + params.cartName);

  var recurrence = CalendarApp.newRecurrence().addWeeklyRule();

  if (params.recurrenceType === 'weeks') {
    var n = parseInt(params.weeks, 10);
    if (!n || n < 1) throw new Error('Invalid number of weeks.');
    recurrence = recurrence.times(n);
  } else if (params.recurrenceType === 'date') {
    var ep = params.endDate.split('-');
    var until = new Date(ep[0], ep[1] - 1, ep[2], 23, 59, 59);
    recurrence = recurrence.until(until);
  } else {
    throw new Error('Invalid recurrence type.');
  }

  cal.createEventSeries(title, startTime, endTime, recurrence, {
    description: buildDescription('RESERVED', params.teacherName, currentEmail, params.period)
  });
}

/**
 * Marks a reservation as checked out. Any domain user can do this.
 */
function checkOut(eventId, cartName) {
  assertDomain();
  var event = getEventById(eventId, cartName);
  var desc = event.getDescription() || '';
  desc = desc.replace('RESERVED', '').replace('RETURNED', '').trim();
  event.setDescription('CHECKED_OUT\n' + desc);
}

/**
 * Marks a reservation as returned. Any domain user can do this.
 */
function checkIn(eventId, cartName) {
  assertDomain();
  var event = getEventById(eventId, cartName);
  var desc = event.getDescription() || '';
  desc = desc.replace('CHECKED_OUT', '').replace('RESERVED', '').trim();
  event.setDescription('RETURNED\n' + desc);
}

/**
 * Cancels (deletes) a reservation. Only the original creator can cancel.
 */
function cancelReservation(eventId, cartName) {
  var currentEmail = assertDomain();
  var event = getEventById(eventId, cartName);
  var creatorEmail = extractEmail(event.getDescription());
  if (creatorEmail && creatorEmail !== currentEmail.toLowerCase()) {
    throw new Error('You can only cancel your own reservations.');
  }
  event.deleteEvent();
}

/**
 * Returns all upcoming reservations made by the current user across all carts.
 */
function getMyReservations() {
  var currentEmail = assertDomain();
  var carts = getCartConfig();
  var now    = new Date();
  var future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  var result = [];

  for (var cartName in carts) {
    var calId = carts[cartName];
    try {
      var cal = CalendarApp.getCalendarById(calId);
      if (!cal) continue;
      var events = cal.getEvents(now, future);
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        var desc = ev.getDescription() || '';
        if (extractEmail(desc) !== currentEmail.toLowerCase()) continue;
        var status = 'RESERVED';
        if (desc.indexOf('CHECKED_OUT') !== -1) status = 'CHECKED_OUT';
        if (desc.indexOf('RETURNED')    !== -1) status = 'RETURNED';
        result.push({
          eventId:  ev.getId(),
          cartName: cartName,
          title:    ev.getTitle(),
          start:    ev.getStartTime().getTime(),
          end:      ev.getEndTime().getTime(),
          status:   status
        });
      }
    } catch (e) {
      Logger.log('getMyReservations error for ' + cartName + ': ' + e.message);
    }
  }

  result.sort(function(a, b) { return a.start - b.start; });
  return result;
}

/**
 * Returns Google Calendar embed URLs (month view) for each cart.
 */
function getCalendarEmbedUrls() {
  assertDomain();
  var carts = getCartConfig();
  var urls = {};
  for (var name in carts) {
    var id = carts[name];
    if (id === 'primary') {
      urls[name] = 'https://calendar.google.com/calendar/embed?ctz=America%2FNew_York&mode=MONTH';
    } else {
      urls[name] = 'https://calendar.google.com/calendar/embed?src=' +
                   encodeURIComponent(id) +
                   '&ctz=America%2FNew_York&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&mode=MONTH';
    }
  }
  return urls;
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

function getEventsForDate(dateString, currentEmail, carts) {
  var parts = dateString.split('-');
  var dayStart = new Date(parts[0], parts[1] - 1, parts[2], DAY_START_HOUR, 0, 0);
  var dayEnd   = new Date(parts[0], parts[1] - 1, parts[2], DAY_END_HOUR,   0, 0);
  var result = {};

  for (var cartName in carts) {
    var calId = carts[cartName];
    var events = [];
    try {
      var cal = CalendarApp.getCalendarById(calId);
      if (!cal) { result[cartName] = []; continue; }
      var calEvents = cal.getEvents(dayStart, dayEnd);
      for (var i = 0; i < calEvents.length; i++) {
        var ev = calEvents[i];
        var desc = ev.getDescription() || '';
        var status = 'RESERVED';
        if (desc.indexOf('CHECKED_OUT') !== -1) status = 'CHECKED_OUT';
        if (desc.indexOf('RETURNED')    !== -1) status = 'RETURNED';
        var creatorEmail = extractEmail(desc);
        events.push({
          eventId:      ev.getId(),
          title:        ev.getTitle(),
          teacherEmail: creatorEmail,
          start:        ev.getStartTime().getTime(),
          end:          ev.getEndTime().getTime(),
          status:       status,
          isOwner:      creatorEmail === currentEmail.toLowerCase()
        });
      }
    } catch (e) {
      Logger.log('getEventsForDate error for ' + cartName + ': ' + e.message);
    }
    result[cartName] = events;
  }
  return result;
}

function getEventById(eventId, cartName) {
  var carts = getCartConfig();
  var calId = carts[cartName];
  if (!calId) throw new Error('Unknown cart: ' + cartName);
  var cal = CalendarApp.getCalendarById(calId);
  if (!cal) throw new Error('Could not access calendar for ' + cartName);
  var event = cal.getEventById(eventId);
  if (!event) throw new Error('Event not found.');
  return event;
}

function extractEmail(desc) {
  var m = (desc || '').match(/Email:\s*(\S+)/);
  return m ? m[1].toLowerCase() : '';
}

function buildDescription(status, teacherName, email, period) {
  return status + '\nTeacher: ' + teacherName +
         '\nEmail: ' + email.toLowerCase() +
         '\nPeriod: ' + (period || 'N/A');
}
