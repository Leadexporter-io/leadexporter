let pageType;
const PAGETYPE_SALES_NAVIGATOR = 'Sales Navigator';
const PAGETYPE_REGULAR_LINKEDIN = 'Regular LinkedIn';
const PAGETYPE_GMAIL = 'Gmail';
const PAGETYPE_LINKEDIN_MESSAGING = 'LinkedIn Messaging';
const IFRAME_WIDTH_MINIMIZED = 50;
const IFRAME_WIDTH_MAXIMIZED = 470;
const SERVER_URL = 'http://localhost:10/api';
const SAVEAS_MODE_LEAD = 'Lead';
const SAVEAS_MODE_CONTACT = 'Contact';
const SEARCH_COMPANY_SUBMIT_BUTTON_LABEL = '<i class="fa fa-search"></i>';
const SUBMIT_BUTTON_LABEL = 'Save To CRM';
const FIELDTYPE_TEXT = 'text';
const FIELDTYPE_NUMBER = 'number';
const FIELDTYPE_EMAIL = 'email';
const FIELDTYPE_TEXTAREA = 'text area';
const FIELDTYPE_PICKLIST = 'picklist';
let FIELDS;
let FIELDNAMES;
let MESSAGES = [];
const bootstrapCSSURL = chrome.extension.getURL("css/bootstrap.min.css");
const bootstrapJSURL = chrome.extension.getURL("js/bootstrap.min.js");
const popperURL = chrome.extension.getURL("js/popper.min.js");
const fontAwesomeCSSURL = chrome.extension.getURL("fonts/font-awesome-4.7.0/css/font-awesome.min.css");
const loadingImageURL = chrome.extension.getURL("img/loading.gif");
const darkColor = '#004b7c';
var apiKey;
var userId;
let jobInterval;
let whoId;
var data;
var mode;

let jobs = [];
var iframe;
var iFrameDOM;
var minimizedDiv;
var oldURL;
var currentURL;
var profileURL;

function splitName(name) {
  let nameSplit = name.split(" ");
  let firstName = nameSplit[0];
  let lastName = name.substring(firstName.length + 1, name.length);

  return { firstName, lastName };
}

function splitLocation(location) {
  let locationSplit = location.split(", ");
  let country = '';
  let city = '';
  if (locationSplit.length === 1) {
    country = location;
  } else {
    city = locationSplit[0];
    country = locationSplit[locationSplit.length - 1];
  }

  // Remove 'area' if it's part of the city
  city = city.replace(' Area', '');

  return { city, country };
}

function isPositionCurrent(datesEmployed) {
  return (datesEmployed.indexOf(' – Present') > -1);
}

function loadJob(title, company) {
  console.log('loadJob for ' + title, company);

  iFrameDOM.find("#title").val(title);
  iFrameDOM.find("#company-name-lead").val(company);
  iFrameDOM.find("#search-company-query").val(company);
  // Reset Contact company name and id fields
  iFrameDOM.find("#company-name-contact").val(null);
  iFrameDOM.find("#company-id-contact").val(null);
}

function changeJob() {
  let jobNumber = iFrameDOM.find('#job-selector').val();
  if (jobNumber) {
    loadJob(jobs[jobNumber].title, jobs[jobNumber].company);
  } else {
    loadJob('', '');
  }
}

/* returns array with active jobs from the elements to analyse */
function analyzeRegularLinkedInPageJobs(allJobs){
  const jobs = [];
  $.each(allJobs, function(index, job) {
    let jobDetails = $(job).find(".pv-entity__summary-info");
    $.each(jobDetails, function (index, jobDetail) {
      let jobDetailText = $(jobDetail).text();
      if (isPositionCurrent(jobDetailText)) {

        let jobDetailTextSplit = jobDetailText.split("\n");
        let job = {
          title: (jobDetailTextSplit.length > 1 ? jobDetailTextSplit[1].trim() : ''),
          company: (jobDetailTextSplit.length > 5 ? jobDetailTextSplit[5].trim() : ''),
        };
        jobs.push(job);
      }
    });
  });
  return jobs;
}

function switchSaveAsMode() {
  // let saveAsMode = iFrameDOM.find('input[name=save-as]:checked').val();
  console.log('switch to ' + mode + ' mode');
  if (mode === SAVEAS_MODE_LEAD) {
    console.log('showing lead');
    iFrameDOM.find("#company-input-contact").css("display", "none");
    iFrameDOM.find("#company-input-lead").css("display", "block");
  } else {
    console.log('showing contact');
    iFrameDOM.find("#company-input-lead").css("display", "none");
    iFrameDOM.find("#company-input-contact").css("display", "block");
  }
}

function createTask(message, i) {
  const authorLinkedIn = $('.msg-thread__topcard-btn').prop('href');
  console.log('conversation with ' + authorLinkedIn);

  const postData = { authorLinkedIn,
                     message,
                     userId,
                     apiKey,
                     whoId };

  console.log('postData:' + JSON.stringify(postData));
  $('#taskMessage' + i).html('<b>Saving...</b>');
  $.post(SERVER_URL + '/task', postData, (result) => {
    console.log('result from creating task:' + JSON.stringify(result));
    $('#taskMessage' + i).html('<a href="' + result.link +'" target="_blank"><b>Task Saved</b></a>');
  });
}

function createLink(messageGroup, i, tempMessage, taskExists, recordLink) {
  // Create the link and the event binder
  let link;
  if (taskExists) {
    link = '<div id="taskMessage' + i + '"><a href="' + recordLink + '" target="_blank">Task Saved</a></div>';
  } else {
    link = '<div id="taskMessage' + i + '"><a id=\"create-task-' + i + '\" href=\"!#\">Create task</a></div>';
  }
  $(messageGroup).find('.msg-s-message-group__meta').html($(messageGroup).find('.msg-s-message-group__meta').html() + link);
  $('#create-task-' + i).on('click', function (e) {
    e.preventDefault();
    // Get the id of the element that's clicked
    const id = $(this).prop('id');
    const counter = id.slice(-1);

    createTask(MESSAGES[counter], counter);
  });

  // Save this message
  MESSAGES.push(tempMessage);
}

/* Handle scenario where page is 'loaded' but not all elements are (due to async loading) */
/* function refillForm() {
  console.log('doing refillForm' + new Date());
  console.log('nameElementExists:' + nameElementExists);
  const salesNavigatorNameElement = document.querySelector('.profile-topcard-person-entity__name');
  const linkedInNameElement = document.querySelector('.pv-top-card-section__name');
  console.log('salesNavigatorNameElement:' + salesNavigatorNameElement);
  console.log('linkedInNameElement:' + linkedInNameElement);
  if (salesNavigatorNameElement || linkedInNameElement) {
    console.log('match');
    fillForm();
    clearInterval(nameInterval);
  }
} */

function nameElementLoaded() {
  const salesNavigatorNameElement = document.querySelector('.profile-topcard-person-entity__name');
  const linkedInNameElement = document.querySelector('.pv-top-card-section__name');
  return (salesNavigatorNameElement || linkedInNameElement);
}

function getJobs() {
  console.log('getJobs');

  let allJobs;
  // Collect the jobs from the page
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    jobs = [];
    // console.log('checking for jobs on regular linkedIn page');
    allJobs = $("#experience-section").find(".pv-profile-section__sortable-card-item");
    jobs = jobs.concat(analyzeRegularLinkedInPageJobs(allJobs));
    allJobs = $("#experience-section").find(".pv-profile-section__card-item");
    jobs = jobs.concat(analyzeRegularLinkedInPageJobs(allJobs));

    // Load jobs in a dropdown
    if (jobs.length !== 0 && jobInterval) {
      createJobsDropdown(jobs);

      // Stop checking if the jobs section is loaded
      clearInterval(jobInterval);
    }
  } else {
    // console.log('checking for jobs on Sales Navigator page');
    if (data && data.positions) {
      jobs = [];
      for (let p = 0; p < data.positions.length; p++) {
        if (data.positions[p].current) {
          let job = {
            title: data.positions[p].title,
            company: data.positions[p].companyName,
          };
          jobs.push(job);
        }
      }
      createJobsDropdown(jobs);
    } else {
      console.log('data.positions not initialized');
    }
  }
}

function createJobsDropdown(jobs) {
  console.log('createJobsDropdown for ' + JSON.stringify(jobs));
  // Create dropdown code
  let jobsHTML = '<select id="job-selector">';
  if (jobs.length > 1) {
    jobsHTML += '<option value="">Please select a job</option>';
  }
  for (let j = 0; j < jobs.length; j++) {
    jobsHTML += '<option value="' + j + '">' + jobs[j].title + ' - ' + jobs[j].company + '</option>';
  }
  jobsHTML += '</select>';

  // Load html
  iFrameDOM.find("#jobs").html(jobsHTML);

  // Add event listener
  iFrameDOM.find('#job-selector').change(changeJob);

  // Load job if there is only one
  if (jobs.length === 1) {
    loadJob(jobs[0].title, jobs[0].company);
  }
}

function getName() {
  let result = {};

  if (pageType === PAGETYPE_SALES_NAVIGATOR ) {
    if (data) {
      result.name = data.fullName;
      result.firstName = data.firstName;
      result.lastName = data.lastName;
    } else {
      console.log('getName: data not initialised');
    }
  }
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    nameElement = document.querySelector('.pv-top-card-section__name');
    result.name = nameElement.innerHTML.trim();
    let nameSplit = splitName(result.name);
    result.firstName = nameSplit.firstName;
    result.lastName = nameSplit.lastName;
  }

  return result;
}

function getLinkedFromUrl(url) {
  if (url) {
    // Take only the part before #
    let linkedInSplit = url.split('#');
    if (linkedInSplit.length > 0){
      linkedIn = linkedInSplit[0];
    }
    // Take only the part before any slashes after the username
    linkedInSplit = linkedIn.split('/in/');
    if (linkedInSplit.length > 1) {
      let username = linkedInSplit[1];
      let usernameSplit = username.split('/');
      linkedIn = linkedInSplit[0] + '/in/' + usernameSplit[0];
    }
    return linkedIn;
  }
}

// Gets the LinkedIn address
function getLinkedIn(url) {
  let linkedIn;
  if (pageType === PAGETYPE_SALES_NAVIGATOR ) {
    if (data) {
      linkedIn = data.flagshipProfileUrl;
    } else {
      console.log('getLinkedIn: data not initialised');
    }
  }
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    linkedIn = getLinkedFromUrl(url);
  }

  // Remove trailing slash
  if (linkedIn && linkedIn.slice(-1) === '/') {
    linkedIn = linkedIn.substring(0, linkedIn.length - 1);
  }

  return linkedIn;
}

// Gets the LinkedIn data in JSON format and loads it into global var data
function initData() {
  console.log('doing initData');
  const codes = document.querySelectorAll('code');
  console.log('codes: ' + codes.length);
  const parseJsonIfPossible = (rawJson) => {
    try {
      return JSON.parse(rawJson);
    } catch (e) {
      console.log('error parsing data:' + e);
      return {};
    }
  };

  for (let i = 0; i < codes.length; i += 1) {
    // decodeURIComponent sometimes gave errors
    // let code = parseJsonIfPossible(decodeURIComponent(codes[i].innerText.trim()));
    let code;
    let codeText = codes[i].innerText.trim();

    try {
      code = JSON.parse(codeText);
    } catch (e) {
      console.log('parsing failed for ' + codeText + '. Now try with decoding.');
      code = parseJsonIfPossible(decodeURIComponent(codeText));
    }

    if (code.firstName) {
      console.log('data node set for ' + code.firstName);
      data = code;
      console.log(codeText);
      // break;
    }
  }
}

function fillForm() {
  console.log('fillForm');
  let name = '';
  let firstName = '';
  let lastName = '';
  // let headline = '';
  let location = '';
  // let summary = '';
  let title = '';
  let company = '';
  let city = '';
  let country = '';
  let linkedIn = '';
  let phone = '';
  let email = '';
  let website = '';
  let twitter = '';

  let phones = [];
  let emails = [];
  let websites = [];
  let twitters = [];

  let url = window.location.href;
  console.log('url:' + url);
  console.log('data: ' + JSON.stringify(data));
  console.log('pageType: ' + pageType);


  if (pageType === PAGETYPE_SALES_NAVIGATOR) {
    console.log('Processing Sales Navigator Profile');
    maximize();

    // name
    name = data.fullName;
    firstName = data.firstName;
    lastName = data.lastName;

    // location
    location = data.location;
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    country = locationSplit.country;

    // contact info
    if (data.contactInfo) {
      if (data.contactInfo.primaryEmail) {
        email = data.contactInfo.primaryEmail;
      }
      if (data.contactInfo.emails) {
        for (let e = 0; e < data.contactInfo.emails.length; e++) {
          emails.push(data.contactInfo.emails[e].emailAddress);
        }
      }
      if (data.contactInfo.socialHandles) {
        for (let h = 0; h < data.contactInfo.socialHandles.length; h++) {
          if (data.contactInfo.socialHandles[h].type === 'TWITTER') {
            twitters.push(data.contactInfo.socialHandles[h].name);
          }
        }
      }
      if (data.contactInfo.websites) {
        for (let w = 0; w < data.contactInfo.websites.length; w++) {
          websites.push(data.contactInfo.websites[w].url);
        }
      }
      if (data.contactInfo.phoneNumbers) {
        for (let p = 0; p < data.contactInfo.phoneNumbers.length; p++) {
          phones.push(data.contactInfo.phoneNumbers[p].number);
        }
      }

      if (emails.length > 0) {
        email = emails[0];
      }
      if (websites.length > 0) {
        website = websites[0];
      }
      if (twitters.length > 0) {
        twitter = twitters[0];
      }
      if (phones.length > 0) {
        phone = phones[0];
      }
    }

    // LinkedIn
    linkedIn = getLinkedIn();

    // Jobs
    getJobs();

  } else if (pageType ===  PAGETYPE_REGULAR_LINKEDIN) {
    console.log('processing regular LinkedIn profile');
    maximize();

    // Name
    let nameResult = getName();
    name = nameResult.name;
    firstName = nameResult.firstName;
    lastName = nameResult.lastName;

    // Location
    let locationElement = document.querySelector('.pv-top-card-section__location');
    location = (locationElement ? locationElement.innerHTML.trim() : '');
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    country = locationSplit.country;

    // LinkedIn
    linkedIn = getLinkedIn(url);

    // Jobs
    jobInterval = setInterval(getJobs, 1000);

  } else if (pageType === PAGETYPE_GMAIL) {
    console.log('processing Gmail');
    maximize();

    nameElements = $('.gD');
    console.log(nameElements);
    if (nameElements.length > 0) {
      // Take the latest one
      const nameElement = $(nameElements[nameElements.length - 1]);
      name = nameElement.text().trim();

      let nameSplit = splitName(name);
      firstName = nameSplit.firstName;
      lastName = nameSplit.lastName;

      email = nameElement.attr('email');
    }
  } else {
    minimize();
  }

  /* if (!nameElement) {
    nameInterval = setInterval(refillForm, 1000);
  } */



  // Load the data into the the form
  if (iFrameDOM.find('#name')) {
    iFrameDOM.find('#name').text('Full name: ' + name);
  }

  if (iFrameDOM.find('#firstName')) {
    iFrameDOM.find('#firstName').val(firstName);
  }

  if (iFrameDOM.find('#lastName')) {
    iFrameDOM.find('#lastName').val(lastName);
  }

  if (iFrameDOM.find('#city')) {
    iFrameDOM.find('#city').val(city);
  }

  if (iFrameDOM.find('#country')) {
    iFrameDOM.find('#country').val(country);
  }

  if (iFrameDOM.find('#linkedIn')) {
    iFrameDOM.find('#linkedIn').val(linkedIn);
  }

  if (iFrameDOM.find('#phone')) {
    iFrameDOM.find('#phone').val(phone);
  }

  if (iFrameDOM.find('#email')) {
    iFrameDOM.find('#email').val(email);
  }

  if (iFrameDOM.find('#website')) {
    iFrameDOM.find('#website').val(website);
  }

  if (iFrameDOM.find('#twitter')) {
    iFrameDOM.find('#twitter').val(twitter);
  }

}

function createForm() {
  let html = '';
  html += '<form id="form">';

  if (FIELDS) {
    let nameShown = false;
    for (let f = 0; f < FIELDS.length; f++) {
      if (FIELDS[f].name === 'firstName' || FIELDS[f].name === 'lastName') {
        if (!nameShown) {
          html += '<label>Name</label>';
          html += '<div class="form-row">';
          html += ' <div class="col">';
          html += '  <input type="text" class="form-control" id="firstName" name="firstName" />';
          html += ' </div>';
          html += ' <div class="col">';
          html += '  <input type="text" class="form-control" id="lastName" name="lastName" />';
          html += ' </div>';
          html += '</div>';
          html += '<small class="form-text text-muted" id="name"></small>';

          nameShown = true;
        }
      } else if (FIELDS[f].name !== 'title' && FIELDS[f].name !== 'company') {
        html += '<div class="form-group">';
        if (FIELDS[f].type === FIELDTYPE_TEXT || FIELDS[f].type === FIELDTYPE_NUMBER || FIELDS[f].type === FIELDTYPE_EMAIL) {
          html += '  <label for="' + FIELDS[f].name + '">' + FIELDS[f].label + '</label>';
          html += '  <input type="' + FIELDS[f].type + '" class="form-control" id="' + FIELDS[f].name + '" name="' + FIELDS[f].name + '" ' + (FIELDS[f].required ? ' required="required"' : '') + '/>';
        }
        if (FIELDS[f].type === FIELDTYPE_TEXTAREA) {
          html += '  <label for="' + FIELDS[f].name + '">' + FIELDS[f].label + '</label>';
          html += '  <textarea class="form-control" id="' + FIELDS[f].name + '" name="' + FIELDS[f].name + '" ' + (FIELDS[f].required ? ' required="required"' : '') + ' rows="3"></textarea>';
        }
        if (FIELDS[f].type === FIELDTYPE_PICKLIST) {
          html += '  <label for="' + FIELDS[f].name + '">' + FIELDS[f].label + '</label>';
          html += '  <select class="form-control" id="' + FIELDS[f].name + '" name="' + FIELDS[f].name + '" ' + (FIELDS[f].required ? ' required="required"' : '') + '>';
          if (FIELDS[f].picklistValues) {
            for (let v = 0; v < FIELDS[f].picklistValues.length; v++) {
              html += '  <option value="' + FIELDS[f].picklistValues[v].value + '">' + FIELDS[f].picklistValues[v].label + '</option>';
            }
          }
          html += '  </select>';
        }
        html += '</div>';
      }
    }
  }

  /* html += '<div class="dropdown">';
  html += '      <button id="dLabel" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">';
  html += '          Dropdown trigger';
  html += '          <span class="caret"></span>';
  html += '      </button>';

  html += '    <ul class="dropdown-menu" role="menu" aria-labelledby="dLabel">';
  html += '        <li role="presentation" class="dropdown">';
  html += '            <a role="menuitem" tabindex="-1" href="#">';
  html += '                Much much much longer text not fitting when resizing';
  html += '            </a>';
  html += '        </li>';
  html += '        <li role="presentation" class="dropdown">';
  html += '            <a role="menuitem" tabindex="-1" href="#">';
  html += '                Smaller text';
  html += '            </a>';
  html += '        </li>';
  html += '    </ul>';
  html += '  </div>'; */

  html += '<h3>Current Jobs</h3>';
  html += '<div id="jobs">Scroll down to load jobs</div>';
  html += '<div class="form-group">';
  html += '  <label for="title">Title</label>';
  html += '  <input type="text" class="form-control" id="title" name="title" required />';
  html += '</div>';
  html += '<div id="company-input">';
  html += '  <div class="form-group" id="company-input-lead">';
  html += '    <label for="company-name-lead">Company</label>';
  html += '    <input type="text" class="form-control company-input" id="company-name-lead" />';
  html += '  </div>';
  html += '  <div class="form-group mb-0" id="company-input-contact" style="display: none">';
  html += '    <label>Company</label>';
  html += '    <div class="input-group">';
  html += '      <div class="input-group-prepend">';
  html += '        <span class="input-group-text" id="open-search-company-form-button"><a href="#!"><i class="fa fa-search"></i></a></span>';
  html += '      </div>';
  html += '      <input type="text" class="form-control company-input" id="company-name-contact" readonly required />';
  html += '    </div>';
  html += '    <input type="hidden" id="company-id-contact" />';
  html += '  </div>';
  html += '  <div id="search-company-popup" class="collapse shadow">';
  html += '    <div class="input-group mb-0" id="search-company-popup-input-row">';
  html += '      <input type="text" id="search-company-query" class="form-control" placeholder="Company name"/>';
  html += '      <span class="input-group-btn">';
  html += '        <button type="button" id="search-company-submit-button" class="btn btn-primary">' + SEARCH_COMPANY_SUBMIT_BUTTON_LABEL + '</button>';
  html += '      </span>';
  html += '    </div>';
  html += '    <div id="search-company-results">';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  html += '<br/>';
  /* html += '<div class="form-check form-check-inline">';
  html += ' <input class="form-check-input" type="radio" name="save-as" id="save-as-lead" value="lead" checked />';
  html += ' <label class="form-check-label" for="save-as-lead">Lead</label>';
  html += '</div>';
  html += '<div class="form-check form-check-inline">';
  html += ' <input class="form-check-input" type="radio" name="save-as" id="save-as-contact" value="contact" />';
  html += ' <label class="form-check-label" for="save-as-contact">Contact</label>';
  html += '</div>';
  html += '<br/>';*/
  html += '<div id="submit-success-message" class="alert alert-success"></div>';
  html += '<div id="submit-error-message" class="alert alert-danger"></div>';
  html += '<button type="submit" id="submit-button" class="btn btn-primary">Save To CRM</button>';
  html += '</form>';

  return html;
}

function replateNullWithNA(text) {
  return (text ? text : 'N/A');
}

function createFrameTemplate() {
  let html = '<!DOCTYPE html><html>';
  html += '<head>';
  html += '<link rel="stylesheet" href="' + bootstrapCSSURL + '" />';
  html += '<link rel="stylesheet" href="' + fontAwesomeCSSURL + '" />';
  html += '<style>';
  html += 'body {';
  html += '  margin: 0px;';
  html += '  right: 0;';
  html += '  width: 95vw;';
  html += '  height: 100vh;';
  html += '  background: white;';
  html += '  color: black;';
  html += '}';
  html += '#profile-picture {';
  html += '  margin-top: 20px;'
  html += '  border-radius: 50%;';
  html += '  width: 200px;';
  html += '  height: 200px;';
  html += '}';
  html += '#menu {';
  html += '  background-color: ' + darkColor + ';';
  html += '  width: 100%;'
  html += '  height: 30px;'
  html += '}';
  html += '#content {';
  html += '  padding-top: 10px;';
  html += '  padding-right: 0px;';
  html += '  padding-bottom: 10px;';
  html += '  padding-left: 10px;';
  // html += '  width: 100%;';
  // html += '  height: 100%;';
  html += '}';
  html += 'a.menu-icon-link {';
  html += '  color: #fff';
  html += '}';
  html += 'div.menu-icon {';
  html += '  padding-top: 5px;';
  html += '}';
  html += '#logout-button { float: left; }';
  html += '#minimize-button { float: right; }';
  html += '#job-selector { background: #fff; }';
  html += '#back-button { float: left; }'
  html += '#minimize-button { float: right; }';
  html += '#submit-error-message { display: none; }';
  html += '#submit-success-message { display: none; }';
  html += 'input:valid { border-bottom: 1px solid green; }';
  html += 'input:invalid { border-bottom: 1px solid red; }';
  html += '#search-company-popup { padding: 10px; border-radius: 4px; border: 1px solid #ccc; margin-top: -1px;}';
  html += '#search-company-query { border: 1px solid #ccc !important }'; // To avoid the query input having a green bar (coming from the 'valid' validation class)
  html += '</style>';

  html += '</head>';
  html += '<body>';
  html += '<div id="menu" class="row" style="margin-right: 0px !important; margin-left: 0px !important">';
  html += '  <div class="col-2 menu-icon"><a href="#" class="menu-icon-link"><i class="fa fa-sign-out" alt="log out" aria-hidden="true" id="logout-button" data-toggle="tooltip" title="Log out"></i></a></div>';
  html += '  <div class="col-6" style="text-align: center;"><span style="color: #ffffff;">LeadExporter.io</span></div>';
  html += '  <div class="col-2 menu-icon"><a href="#" class="menu-icon-link"><i class="fa fa-arrow-left" aria-hidden="true" id="back-button" data-toggle="tooltip" title="Back to previous screen"></i></a></div>';
  html += '  <div class="col-2 menu-icon"><a href="#" class="menu-icon-link"><i class="fa fa-window-minimize" aria-hidden="true" id="minimize-button" data-toggle="tooltip" title="Minimize LeadExporter.io"></i></a></div>';
  html += '</div>';
  html += '<div id="content">';
  html += '</div>';
  // html += '<script src="' + chrome.extension.getURL('js/bootstrap.min.js'); +'"/>';
  html += '</body>';
  html += '</html>';

  return html;
}

function createContactSidebar(contact, contacts, linkedIn, name, profilePictureURL) {
  let isProfilePage = (pageType === PAGETYPE_SALES_NAVIGATOR || pageType === PAGETYPE_REGULAR_LINKEDIN);
  let objectPlural = (mode === SAVEAS_MODE_LEAD ? 'leads' : 'contacts') ;
  let objectSingular = (mode === SAVEAS_MODE_LEAD ? 'lead' : 'contact');

  let html = '';
  html += '<img id="profile-picture" src="' + profilePictureURL + '" class="mx-auto d-block"/>';
  html += '<br/>';
  html += '<h2 class="text-center">' + name + '</h2>';
  if (!isProfilePage) {
    html += '<p class="text-center"><a href="' + linkedIn + '" target="_blank">View LinkedIn Profile</a></p>';
  }
  if (contact) {
    html += '<p class="text-center"><a href="' + contact.link + '" target="_blank">View in Salesforce</a></p>';
    html += 'Title: ' + replateNullWithNA(contact.title) + '<br/>';
    html += 'Company: ' + replateNullWithNA(contact.company);
    if (isProfilePage) {
      html += '<br/><br/><button class="btn btn-primary" id="open-form-button">Open Form</button>';
    }
  }
  if (contacts) {
    if (contacts.length === 0) {
      html += 'We did not find any ' + objectPlural + ' with the name <b>' + name + '</b>.';
      html += '<br/><br/>';
      html += '<p class="text-center">';
      if (isProfilePage) {
        html += '<a class="btn btn-primary" href="!#" id="create-contact-button">Create ' + objectSingular + '</a>';
      } else {
        html += '<a class="btn btn-primary" href="' + linkedIn + '" target="_blank">Go to profile and create ' + objectSingular + '</a>';
      }
      html += '</p>';
    } else {
      html += 'We found one or more ' + objectPlural + ' in Salesforce with this name, which are <b>not linked</b> to this LinkedIn profile:<br/><br/>';
      for (let c = 0; c < contacts.length; c++) {
        html += '<p style="float: left; "><a href="' + contacts[c].link + '" target="_blank">' + contacts[c].name + '</a></p>';
        html += '<p style="float: right; "><a class="btn btn-primary link-contact" href="!#" id="' + contacts[c].id + '">Link to LinkedIn profile</a></p>';
        html += '<br/><br/>';
      }
    }
  }

  return html;
}

function createLoginForm() {
  let html = '';
  html += '<h2>Login</h2>';
  html += ' <form id="login-form">';
  html += '  <div class="form-group">';
  html += '    <label for="email">E-mail</label>';
  html += '    <input type="text" class="form-control" id="email" name="email" required="required"/>';
  html += '  </div>';
  html += '  <div class="form-group">';
  html += '    <label for="password">Password</label>';
  html += '    <input type="password" class="form-control" id="password" name="password" required="required"/>';
  html += '  </div>';
  html += '  <div class="alert alert-danger" id="login-error-message" style="display: none" ></div>';
  html += '  <button type="submit" class="btn btn-primary">Log In</button>';
  html += ' </form>';

  return html;
}

function minimize() {
  console.log('minimizing extension');
  $(iframe).css('width', IFRAME_WIDTH_MINIMIZED + 'px');
  $(iframe).css('display', 'none');
}

function maximize() {
  console.log('maximizing extension');
  $(iframe).css('width', IFRAME_WIDTH_MAXIMIZED + 'px');
  $(iframe).css('display', 'block');
}

function hideMessages() {
  iFrameDOM.find('#submit-success-message').css('display', 'none');
  iFrameDOM.find('#submit-error-message').css('display', 'none');
}

function showErrorMessage(message) {
  iFrameDOM.find('#submit-error-message').text(message);
  iFrameDOM.find('#submit-error-message').css('display', 'block');
  iFrameDOM.find('#submit-success-message').css('display', 'none');
}

function showSuccessMessage(message) {
  iFrameDOM.find('#submit-success-message').html(message);
  iFrameDOM.find('#submit-error-message').css('display', 'none');
  iFrameDOM.find('#submit-success-message').css('display', 'block');
}

/* function getSaveAsMode() {
  return iFrameDOM.find('input[name=save-as]:checked').val();
} */

function getCompanyName() {
  // if (getSaveAsMode() === SAVEAS_MODE_LEAD) {
  if (mode === SAVEAS_MODE_LEAD) {
    return iFrameDOM.find('#company-name-lead').val();
  } else {
    return iFrameDOM.find('#company-name-contact').val();
  }
}

function linkContact(contactId, linkedIn) {
  console.log('linkedContact with contactId ' + contactId + ' and linkedIn:' + linkedIn);

  const saveAs = mode; // getSaveAsMode();

  // Get all elements in the form and put them in an array
  const valuesArray = [];
  valuesArray.push(['linkedIn', linkedIn]);

  const postData = { valuesArray,
                     saveAs,
                     contactId,
                     userId,
                     apiKey };

  console.log('postData:' + JSON.stringify(postData));

  // hideMessages();
  // iFrameDOM.find('#submit-button').html('<i class="fa fa-circle-o-notch fa-spin"></i> Saving...');

  $.post(SERVER_URL + '/contact/update', postData, (result) => {
    console.log(JSON.stringify(result));
    if (result.success) {
      loadFrameContent();
    }
    /* iFrameDOM.find('#submit-button').html(SUBMIT_BUTTON_LABEL);
    if (result.success) {
      showSuccessMessage('Record successfully created: <a href="' + result.link + '" target="_blank">' + result.name + '</a>');
    } else {
      showErrorMessage('Record creation failed: ' + result.error);
    } */
  });
}

function submit() {
  console.log('submit');

  const saveAs = mode; // getSaveAsMode();

  // Get all elements in the form and put them in an array
  const valuesArray = [];
  iFrameDOM.find('.form-control').each((index, field) => {
    console.log('mapping ' + $(field).prop('id') + ' to ' + $(field).val());
    valuesArray.push([$(field).prop('id'), $(field).val()]);
  });
  valuesArray.push(['company', (saveAs === SAVEAS_MODE_LEAD ? getCompanyName() : iFrameDOM.find('#company-id-contact').val())]);

  const postData = { valuesArray,
                     saveAs,
                     userId,
                     apiKey,
                     whoId };

  console.log('postData:' + JSON.stringify(postData));

  hideMessages();
  iFrameDOM.find('#submit-button').html('<i class="fa fa-circle-o-notch fa-spin"></i> Saving...');

  $.post(SERVER_URL + '/submit', postData, (result) => {
    console.log(JSON.stringify(result));
    iFrameDOM.find('#submit-button').html(SUBMIT_BUTTON_LABEL);
    if (result.success) {
      const action = (whoId ? 'updated' : 'created');
      showSuccessMessage('Record successfully ' + action + ': <a href="' + result.link + '" target="_blank">' + result.name + '</a>');
    } else {
      showErrorMessage('Record creation failed: ' + result.error);
    }
  });
}

function setLoginVars(_userId, _apiKey) {
  console.log('_userId:' + _userId + ' _apiKey:' + _apiKey);
  chrome.storage.sync.set({'userId': _userId}, function() {});
  chrome.storage.sync.set({'apiKey': _apiKey}, function() {});
  userId = _userId;
  apiKey = _apiKey;
}

function login() {
  iFrameDOM.find('#login-error-message').css('display', 'none');

  const email = iFrameDOM.find('#email').val();
  const password = iFrameDOM.find('#password').val();
  const postData = { email, password };

  $.post(SERVER_URL + '/login', postData, (result) => {
    console.log(JSON.stringify(result));
    if (result.success) {
      console.log('successful login');
      setLoginVars(result.userId, result.apiKey);
      loadFrameContent();
    } else {
      if (result.error === 'Please authorize') {
        setLoginVars(result.userId, result.apiKey);
        populateAuthorizeSidebar();
      } else {
        error = result.error;
        iFrameDOM.find('#login-error-message').text(result.error);
        iFrameDOM.find('#login-error-message').css('display', 'block');
      }
    }
  });
}

function logout() {
  // Clear values from memory
  setLoginVars(null, null);
  // Load login form
  populateLoginForm();
}

function searchCompany() {

  // Get search query
  const q = iFrameDOM.find('#search-company-query').val();
  console.log('q:' + q);

  let resultsHTML = '';
  if (q) {
    // Loading indicator on submit button
    iFrameDOM.find('#search-company-submit-button').html('<i class=\'fa fa-search fa-spin\'></i>');

    // Submit request
    const postData = { userId, apiKey, q };
    $.post(SERVER_URL + '/company/search', postData, (result) => {
      // Reset submit button
      iFrameDOM.find('#search-company-submit-button').html(SEARCH_COMPANY_SUBMIT_BUTTON_LABEL);

      if (result.success) {
        if (result.results) {

          if (result.results.length > 0) {
            resultsHTML = '<ul class="list-group mt-10" id="search-company-result-items" role="tablist">';
            for (let r = 0; r < result.results.length; r++) {
              let company = result.results[r];
              resultsHTML += '<a class="list-group-item list-group-item-action" href="#!" role="tab" data-toggle="list">' + company.name + '<input type="hidden" class="company-id" value="' + company.id + '" /></a>';
            }
            resultsHTML += '</ul>';
          } else {
            resultsHTML = '<div class="alert alert-warning mb-0">No results found. <a href="' + result.createNewLink +'" target="_blank">Create new Account</a>.</div>';
          }

          iFrameDOM.find('#search-company-results').css('margin-top','10px');
          iFrameDOM.find('#search-company-results').html(resultsHTML);
          iFrameDOM.find('#search-company-result-items a').on('click', function (e) {
            e.preventDefault();
            $(this).tab('show');
            const companyId = $(this).find('.company-id').val();
            const companyName = $(this).text();
            selectCompanyResult(companyId, companyName);
          });
        }
      } else {
        console.log(result.error);
      }
    });
  } else {
    resultsHTML = '<div class="alert alert-warning mb-0">Please enter a search query</div>';
    iFrameDOM.find('#search-company-results').html(resultsHTML);
  }

}

function selectCompanyResult(companyId, companyName) {
  console.log('selected companyId:' + companyId + ' companyName:' + companyName);
  iFrameDOM.find('#search-company-results').html('');
  iFrameDOM.find('#company-name-contact').val(companyName);
  iFrameDOM.find('#company-id-contact').val(companyId);

  // Close the popup
  iFrameDOM.find('#search-company-popup').collapse('hide');
}

function openSearchCompanyPopup() {
  console.log('openSearchCompanyPopup');
  // iFrameDOM.find('#search-company-popup').collapse('show');
  iFrameDOM.find('#search-company-popup').collapse('toggle');
}

function createMessageTaskLinks(tasks) {
  let profileLink;
  let profileURL;
  let previousProfileURL;
  let author;
  let previousAuthor;
  let tempMessage = '';
  let message;
  let previousMessageGroup;
  let numberOfListItems = $('.msg-s-event-listitem').length;
  let tasksWithoutSpaces = [];

  if (tasks) {
    for (let t = 0; t < tasks[t].length; t++) {
      const task = tasks[t];
      if (task.description) {
        tasksWithoutSpaces.push(task.description.replace(/\s/g,''));
      }
    }
    console.log(JSON.stringify(tasksWithoutSpaces));
  }

  let i = 0;

  $('.msg-s-event-listitem').each((index, messageGroup) => {

      profileLink = $(messageGroup).find('.msg-s-message-group__profile-link');
      profileURL = profileLink.prop('href') || previousProfileURL;
      author = profileLink.text().trim() || previousAuthor;
      message = $(messageGroup).find('.msg-s-event-listitem__body').text().trim();

      if (message) {
        if (index === 0) {
          previousAuthor = author;
        }
        if (author === previousAuthor && index !== (numberOfListItems -1)) {
          // Add messages together if they are from the same author
          tempMessage += (tempMessage ? '\n' : '') + message;
        } else {

          let taskExists = false;
          let taskLink = '';
          let taskMatchCounter = tasksWithoutSpaces.indexOf(tempMessage.replace(/\s/g,''));
          if (taskMatchCounter > -1) {
            console.log('MESSAGE EXISTS!' + tempMessage);
            taskExists = true;
            taskLink = tasks[taskMatchCounter].link;
          }

          createLink(previousMessageGroup, i, tempMessage, taskExists, taskLink);

          // Start new message
          tempMessage = message;
          i++;
        }

        // For the last line
        if (index === (numberOfListItems -1)) {
          createLink(messageGroup, i, tempMessage);
        }
      }

      previousProfileURL = profileURL;
      previousAuthor = author;
      // Store the last messageGroup with the name of the person, since that's where we want to add the link
      if (profileLink.text().trim()) {
        previousMessageGroup = messageGroup;
      }

  });
}

function populateForm() {
  console.log('populateForm');
  // NO NEED TO EXECUTE THIS BEFORE THE FORM IS LOADED?
  const postData = { userId, apiKey };
  $.post(SERVER_URL + '/fields', postData, (result) => {
    console.log(JSON.stringify(result));
    if (result.success) {
      FIELDS = result.fields;
      FIELDNAMES = result.fieldNames;

      // Create the form
      const formHTML = createForm();
      iFrameDOM.find('#content').html(formHTML);

      // Load the data in the iFrame
      fillForm();

      switchSaveAsMode();

      // Add event listeners
      iFrameDOM.find('input[name=save-as]').each(function(index, radio) {
        radio.addEventListener("change", switchSaveAsMode);
      });
      iFrameDOM.find('#form').submit((event) => {
        // Prevent reloading the page
        event.preventDefault();
        submit();
      });
      iFrameDOM.find('#open-search-company-form-button').click(openSearchCompanyPopup);
      iFrameDOM.find('#search-company-query').keypress((event) => {
         // Since it's a nested form we cannot use submit: fake submit behaviour by accepting enter as a submit
         if (event.keyCode === 13 || event.which === 13) {
           event.preventDefault();
           searchCompany();
         }
      });
      iFrameDOM.find('#search-company-submit-button').click(searchCompany);
    }
  });

}

function populateLoginForm() {
  // Create HTML
  const loginFormHTML = createLoginForm();
  iFrameDOM.find('#content').html(loginFormHTML);

  // Add Event Listeners
  iFrameDOM.find('#login-form').submit((event) => {
    // Prevent reloading the page
    event.preventDefault();
    login();
  });
}

function createAuthorizeSidebar() {
  let html = '<br/>';
  html += '<h2>Authorize</h2>';
  html += '<br/>';
  html += 'Please authorize LeadExporter to connect to your CRM system using the button below.<br/>';
  html += 'After successful authorization, just refresh this page and you\'ll be good to go.<br/>';
  html += '<a class="btn btn-primary" href="' + SERVER_URL + '/authorize-user?userId=' + userId + '&apiKey=' + apiKey + '" target="_blank">Authorize</a>';

  return html;
}

function populateAuthorizeSidebar() {
  // Create HTML
  const authorizeSidebarHTML = createAuthorizeSidebar();
  iFrameDOM.find('#content').html(authorizeSidebarHTML);
}

function getProfilePictureURL() {
  let pictureElement;

  if (pageType === PAGETYPE_SALES_NAVIGATOR) {
    pictureElement = $('.entity-image.entity-size-6.person');
    return pictureElement.prop('src');
  }
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    pictureElement = $('.pv-top-card-section__photo');
    return getBackgroundImageURLFromElement(pictureElement);
  }
}

function getBackgroundImageURLFromElement(pictureElement) {
  if (pictureElement) {
    let pictureURL = pictureElement.css('background-image');
    if (pictureURL) {
      pictureURL = pictureURL.substring(5, pictureURL.length - 2);
      return pictureURL;
    }
  }
}

function createLoadingSidebar() {
  let html = '<br/><br/><br/>';
  html += '<img id="loading-picture" src="' + loadingImageURL + '" class="mx-auto d-block"/>';
  html += '<p class="text-center">Just a sec...</p>';

  return html;
}

function populateContactSidebar(contact, contacts, linkedIn, name, profilePictureURL) {
  // Populate content
  const contactSidebarHTML = createContactSidebar(contact, contacts, linkedIn, name, profilePictureURL);
  iFrameDOM.find('#content').html(contactSidebarHTML);

  // Event handlers
  iFrameDOM.find('#create-contact-button').click((event) => {
    // Prevent reloading the page
    event.preventDefault();

    populateForm();
  });
  iFrameDOM.find('.link-contact').click((event) => {
    // Prevent reloading the page
    event.preventDefault();

    let contactId = event.target.id;
    linkContact(contactId, linkedIn);
  });
  iFrameDOM.find('#open-form-button').click((event) => {
    // Prevent reloading the page
    event.preventDefault();

    populateForm();
  });
}

function populateLoadingSidebar() {
  // Create HTML
  const loadingSidebarHTML = createLoadingSidebar();
  iFrameDOM.find('#content').html(loadingSidebarHTML);
}

function getProfilePictureFromMessagingPage() {
  let profilePictureURL;
  $('.msg-conversation-listitem__link.active').each((index, messageGroup) => {
    let authorPictureElement = $(messageGroup).find('.presence-entity__image');
    if (authorPictureElement.length === 0) {
      authorPictureElement = $(messageGroup).find('.msg-facepile-grid__img--person');
    }
    if (authorPictureElement.length > 0) {
      profilePictureURL = getBackgroundImageURLFromElement(authorPictureElement);
    }

    console.log('we have a picture:' + profilePictureURL);
  });

  return profilePictureURL;
}

function loadFrameContent(urlHasChanged) {

  console.log('userId:' + userId + ' apiKey:' + apiKey);
  if (userId && apiKey) {

    // Determine page type
    if (currentURL.indexOf('/sales/people') > -1) {
      // LinkedIn Sales Navigator page
      pageType = PAGETYPE_SALES_NAVIGATOR;
    } else if (currentURL.indexOf('linkedin.com/in/') > -1){
      // Regular LinkedIn page
      pageType = PAGETYPE_REGULAR_LINKEDIN;
    } else if (currentURL.indexOf('/mail.google.com/mail/u/0/?shva=1#inbox/') > -1) {
      // Gmail
      pageType = PAGETYPE_GMAIL;
    } else if (currentURL.indexOf('/messaging') > -1) {
      // InMail mailbox
      pageType = PAGETYPE_LINKEDIN_MESSAGING;
    }

    if (pageType === PAGETYPE_SALES_NAVIGATOR) {
      initData();
      if (data.flagshipProfileUrl === profileURL && urlHasChanged) {
        console.log('we need to check again');
        location.reload();
        // setTimeout(function(){ loadFrameContent(); }, 1000);
        // loadFrameContent()
      } else {
        profileURL = data.flagshipProfileUrl;
      }
    }

    // Show sidebar with loading content while we're getting all data
    populateLoadingSidebar();

    let linkedIn;
    let name;
    let profilePictureURL;

    if (pageType === PAGETYPE_LINKEDIN_MESSAGING) {
      linkedIn = $('.msg-thread__topcard-btn').prop('href');
      name = $('.msg-entity-lockup__entity-title').text().trim();

      // Because of async loading: keep trying until we found the picture
      profilePictureURL = getProfilePictureFromMessagingPage();
      if (!profilePictureURL) {
        let getProfilePictureFromMessagingPageInterval = setInterval(() => {
          console.log('doing interval');
          profilePictureURL = getProfilePictureFromMessagingPage();
          if (profilePictureURL) {
            iFrameDOM.find('#profile-picture').attr('src', profilePictureURL);
            console.log('clearing interval');
            clearInterval(getProfilePictureFromMessagingPageInterval);
          }
        }, 500);
      }
    } else {
      name = getName().name;
      profilePictureURL = getProfilePictureURL();
      linkedIn = getLinkedIn(currentURL);
    }

    const postData = { linkedIn,
                        name,
                        userId,
                        apiKey };

    $.post(SERVER_URL + '/contact/search', postData, (result) => {
      console.log('result: ' + JSON.stringify(result));
      if (result.success) {
        const contact = result.contact;
        const contacts = result.contacts;
        mode = result.mode;

        if (contact) {
          whoId = (contact ? contact.id : null );
          console.log('whoId:' + whoId);
        }

        populateContactSidebar(contact, contacts, linkedIn, name, profilePictureURL);

        if (currentURL.indexOf('/messaging') > -1) {

          if (whoId) {
            const postData = { whoId,
                               userId,
                               apiKey };
            $.post(SERVER_URL + '/tasks', postData, (result) => {
              if (result.success) {
                const tasks = result.tasks;
                createMessageTaskLinks(tasks);
              }
            });
          }
        }

      } else {
        console.log('request failed: ' + result.error);
      }
    });
  } else {
    populateLoginForm();
  }
}

function checkURLchange(){
  console.log('check URL change');
  currentURL = window.location.href;
  if(currentURL != oldURL) {
    // Reset vars
    console.log('URL has changed!');

    loadFrameContent(true);
    oldURL = currentURL;
  }

  oldURL = window.location.href;
}

$(document).ready(function(){
  // logout();
  console.log('document ready, start loading');
  chrome.storage.sync.get('userId', function(userIdObj) {
    chrome.storage.sync.get('apiKey', function(apiKeyObj) {
      userId = userIdObj.userId;
      apiKey = apiKeyObj.apiKey;

      // Avoid recursive frame insertion...
      var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
      if (!location.ancestorOrigins.contains(extensionOrigin)) {
        let frameId = 'linkedforce-frame';
        // Create iFrame
        iframe = document.createElement('iframe');
        iframe.id = frameId;
        iframe.style.cssText = 'position:fixed;top:0;right:0;display:block;' +
                               'width:' + IFRAME_WIDTH_MAXIMIZED + 'px;height:100%;z-index:1000; border-left: 1px solid #ccc; background-color: white;';
        document.body.appendChild(iframe);

        iFrameDOM = $("iframe#" + frameId).contents();

        // Create head, css and menu for the iframe
        let html = createFrameTemplate();
        iframe.contentDocument.body.innerHTML = '';
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();

        // Event handlers for menu items
        iFrameDOM.find('[data-toggle="tooltip"]').tooltip();
        iFrameDOM.find('#minimize-button').click(minimize);
        iFrameDOM.find('#logout-button').click(logout);
        iFrameDOM.find('#back-button').click(loadFrameContent);

        // Create div for when minimized
        minimizedDiv = document.createElement('div');
        minimizedDiv.id = 'minimizedDiv';
        minimizedDiv.innerHTML = '<div style="text-align: center; height: 500px; line-height: 500px;"><span id="maximize-button" style="display: inline-block; vertical-align: middle; line-height: normal; writing-mode: vertical-rl; text-orientation: upright; color: #ffffff; cursor: pointer;">LeadExporter.io</span></div>';
        minimizedDiv.style.cssText = 'position:fixed;top:0;right:0;display:block;' +
                               'width: 40px; height:100%;z-index:100; border-left: 1px solid #fff; background-color: ' + darkColor + ';';
        document.body.appendChild(minimizedDiv);
        let minimizedDivDOM = $('div#minimizedDiv').contents();
        minimizedDivDOM.find('#maximize-button').click((e) => {
          e.preventDefault();
          maximize();
        });

        oldURL = window.location.href;
        currentURL = window.location.href;

        loadFrameContent();

        // Handle URL changes
        setInterval(function() {
            checkURLchange();
        }, 1000);
      }

    });
  });
});
