let pageType;
const PAGETYPE_SALES_NAVIGATOR = 'LinkedIn Sales Navigator';
const PAGETYPE_RECRUITER = 'LinkedIn Recruiter';
const PAGETYPE_REGULAR_LINKEDIN = 'Regular LinkedIn';
const PAGETYPE_GMAIL = 'Gmail';
const PAGETYPE_LINKEDIN_MESSAGING = 'LinkedIn Messaging';
const EDITION_BUSINESS_DEVELOPER = 'Business Developer';
const EDITION_RECRUITER = 'Recruiter';
const IFRAME_WIDTH_MINIMIZED = 50;
const IFRAME_WIDTH_MAXIMIZED = 470;
const SERVER_URL = 'https://app.leadexporter.io/api';
// const SERVER_URL = 'http://localhost:10/api';
const SAVEAS_MODE_LEAD = 'Lead';
const SAVEAS_MODE_CONTACT = 'Contact';
const SEARCH_COMPANY_SUBMIT_BUTTON_LABEL = '<i class="fa fa-search"></i>';
const LINK_CONTACT_BUTTON_LABEL = 'Link to LinkedIn profile';
const FIELDTYPE_TEXT = 'text';
const FIELDTYPE_NUMBER = 'number';
const FIELDTYPE_EMAIL = 'email';
const FIELDTYPE_TEXTAREA = 'text area';
const FIELDTYPE_PICKLIST = 'picklist';
const FIELDTYPE_CHECKBOX = 'checkbox';
const FIELDNAME_CITY = 'city';
let FIELDS;
let FIELDNAMES;
let MESSAGES = [];
const bootstrapCSSURL = chrome.extension.getURL("css/bootstrap.min.css");
const bootstrapJSURL = chrome.extension.getURL("js/bootstrap.min.js");
const popperURL = chrome.extension.getURL("js/popper.min.js");
const fontAwesomeCSSURL = chrome.extension.getURL("fonts/font-awesome-4.7.0/css/font-awesome.min.css");
const loadingImageURL = chrome.extension.getURL("img/loading.gif");
const faceImageURL = chrome.extension.getURL("img/face.png");
const darkColor = '#004b7c';
const AREAS = [' Area', ' en omgeving', ' und Umgebung', 'Région de ', ' y alrededores'];

var recruiterProfileData;

var apiKey;
var userId;
let jobInterval;
let createMessageTaskLinksInterval;
let whoId;
var data;
var mode;
var edition;
var backendSystemName;
var numberOfMessageItems = 0;

// Positions for Business Developer edition
let jobs = [];
// Positions for Recruiter edition
let positionsMap = new Map();

let educationsMap = new Map();

// let educations = [];
var iframe;
var iFrameDOM;
var minimizedDiv;
var oldURL;
var currentURL;
var profileURL;
var jobsDetected = false;

/* Check if a text is a known US State */
function isUSState(state) {
  const states = [{ state: "Alabama", abbreviation: "AL" },
                  { state: "Alaska", abbreviation: "AK" },
                  { state: "Arkansas", abbreviation: "AR" },
                  { state: "Arizona", abbreviation: "AZ" },
                  { state: "California", abbreviation: "CA" },
                  { state: "Colorado", abbreviation: "CO" },
                  { state: "Connecticut", abbreviation: "CT" },
                  { state: "Delaware", abbreviation: "DE" },
                  { state: "Dist. of Columbia", abbreviation: "DC" },
                  { state: "Florida", abbreviation: "FL" },
                  { state: "Georgia", abbreviation: "GA" },
                  { state: "Hawaii", abbreviation: "HI" },
                  { state: "Idaho", abbreviation: "ID" },
                  { state: "Illinois", abbreviation: "IL" },
                  { state: "Indiana", abbreviation: "IN" },
                  { state: "Iowa", abbreviation: "IA" },
                  { state: "Kansas", abbreviation: "KS" },
                  { state: "Kentucky", abbreviation: "KY" },
                  { state: "Louisiana", abbreviation: "LA" },
                  { state: "Maine", abbreviation: "ME" },
                  { state: "Montana", abbreviation: "MT" },
                  { state: "Nebraska", abbreviation: "NE" },
                  { state: "Nevada", abbreviation: "NV" },
                  { state: "New Hampshire", abbreviation: "NH" },
                  { state: "New Jersey", abbreviation: "NJ" },
                  { state: "New Mexico", abbreviation: "NM" },
                  { state: "New York", abbreviation: "NY" },
                  { state: "North Carolina", abbreviation: "NC" },
                  { state: "North Dakota", abbreviation: "ND" },
                  { state: "Ohio", abbreviation: "OH" },
                  { state: "Oklahoma", abbreviation: "OK" },
                  { state: "Oregon", abbreviation: "OR" },
                  { state: "Maryland", abbreviation: "MD" },
                  { state: "Massachusetts", abbreviation: "MA" },
                  { state: "Michigan", abbreviation: "MI" },
                  { state: "Minnesota", abbreviation: "MN" },
                  { state: "Mississippi", abbreviation: "MS" },
                  { state: "Missouri", abbreviation: "MO" },
                  { state: "Pennsylvania", abbreviation: "PA" },
                  { state: "Rhode Island", abbreviation: "RI" },
                  { state: "South Carolina", abbreviation: "SC" },
                  { state: "South Dakota", abbreviation: "SD" },
                  { state: "Tennessee", abbreviation: "TN" },
                  { state: "Texas", abbreviation: "TX" },
                  { state: "Utah", abbreviation: "UT" },
                  { state: "Vermont", abbreviation: "VT" },
                  { state: "Virginia", abbreviation: "VA" },
                  { state: "Washington", abbreviation: "WA" },
                  { state: "West Virginia", abbreviation: "WV" },
                  { state: "Wisconsin", abbreviation: "WI" },
                  { state: "Wyoming", abbreviation: "WY" }];
  let isState = false;

  for (let s = 0; s < states.length; s++) {
    if (states[s].state === state) {
      isState = true;
      break;
    }
  }

  return isState;
}

function splitName(name) {
  let nameSplit = name.split(" ");
  let firstName = nameSplit[0];
  let lastName = name.substring(firstName.length + 1, name.length);

  return { firstName, lastName };
}

function splitLocation(location) {
  let locationSplit = location.split(", ");
  let country = '';
  let state = '';
  let city = '';

  if (locationSplit.length === 1) {
    country = location;

    // Check if the country contains 'Area' (or translation), if so: that's the city
    for (let a = 0; a < AREAS.length; a++) {
      if (country.indexOf(AREAS[a]) > -1) {
        city = country;
        country = '';
      }
    }

  } else {
    city = locationSplit[0];
    country = locationSplit[locationSplit.length - 1];
    if (locationSplit.length > 2) {
      state = locationSplit[1];
    }
  }

  // For the US, state is shown as country
  if (isUSState(country)) {
    state = country;
    country = 'Unites States';
  }

  // If country is 'Other': leave empty
  if (country === 'Other') {
    country = '';
  }

  return { city, state, country };
}

function isPositionCurrent(datesEmployed) {
  if (datesEmployed) {
    datesEmployed = datesEmployed.toLowerCase();
    const presentTranslations = ['present', 'heden', 'heute', 'actualidad', 'aujourd’hui'];
    let isCurrent = false;
    for (let p = 0; p < presentTranslations.length; p++) {
      if (datesEmployed.indexOf(presentTranslations[p]) > -1) {
        isCurrent = true;
      }
    }
    return isCurrent;
  } else {
    return false;
  }
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
      jobsDetected = true;
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

    jobDetails = $(job).find(".pv-profile-section__card-item-v2");
    $.each(jobDetails, function (index, jobDetail) {

      let company = $(jobDetail).find('.pv-entity__company-summary-info').find('h3').text().trim();
      company = company.substring(14, company.length).trim(); // Skip hidden text 'Company Name'
      let positionsAtCompany = $(jobDetail).find('.pv-entity__position-group-role-item');
      $.each(positionsAtCompany, function (index, positionAtCompany) {
        jobsDetected = true;
        let title = $(positionAtCompany).find('h3').text();
        title = title.substring(15, title.length).trim(); // Skip hidden text 'Title' and some whitespace
        let dates = $(positionAtCompany).find('.pv-entity__date-range').text();
        dates = dates.substring(25, dates.length).trim(); // Skip hidden text 'Dates Employed' and some whitespace
        if (isPositionCurrent(dates)) {
          let job = {
            title,
            company,
          };
          jobs.push(job);
        }
      });
    });
  });
  return jobs;
}

function switchSaveAsMode() {
  // let saveAsMode = iFrameDOM.find('input[name=save-as]:checked').val();
  console.log('switch to ' + mode + ' mode');
  // Close the popup


  if (mode === SAVEAS_MODE_LEAD) {
    console.log('showing lead');
    iFrameDOM.find("#company-input-contact").css("display", "none");
    iFrameDOM.find("#company-input-lead").css("display", "block");
    iFrameDOM.find('#search-company-popup').css("display", "none");
  } else {
    console.log('showing contact');
    iFrameDOM.find("#company-input-lead").css("display", "none");
    iFrameDOM.find("#company-input-contact").css("display", "block");
  }

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

function addToUniqueJobs(jobs, newJobs) {
  let jobStrings = new Set();
  for (let j = 0; j < jobs.length; j++) {
    jobStrings.add(JSON.stringify(jobs[j]));
  }

  for (let j = 0; j < newJobs.length; j++) {
    const newJob = newJobs[j];
    if (!jobStrings.has(JSON.stringify(newJob))) {
      jobStrings.add(JSON.stringify(newJob));
      jobs.push(newJob);
    }
  }

  return jobs;
}

function getJobs() {
  console.log('getJobs');

  let allJobs;
  let jobsDetected = false;
  // Collect the jobs from the page
  if (pageType === PAGETYPE_REGULAR_LINKEDIN || pageType === PAGETYPE_SALES_NAVIGATOR) {
    jobs = [];

    if (pageType === PAGETYPE_REGULAR_LINKEDIN ) {
      console.log('checking for jobs on regular linkedIn page');
      allJobs = $("#experience-section").find(".pv-profile-section__sortable-card-item");
      jobs = addToUniqueJobs(jobs, analyzeRegularLinkedInPageJobs(allJobs));
      allJobs = $("#experience-section").find(".pv-profile-section__card-item");
      jobs = addToUniqueJobs(jobs, analyzeRegularLinkedInPageJobs(allJobs));
      allJobs = $("#experience-section").find(".pv-entity__position-group-pager");
      jobs = addToUniqueJobs(jobs, analyzeRegularLinkedInPageJobs(allJobs));

    } else if (pageType === PAGETYPE_SALES_NAVIGATOR) {
      console.log('checking for jobs on Sales Navigator page');
      allJobs = $("#profile-experience").find(".profile-position");
      $.each(allJobs, function(index, job) {

        let datesEmployedElement = $(job).find(".profile-position__dates-employed");
        let titleElement = $(job).find(".profile-position__title");
        let companyElement = $(job).find(".profile-position__secondary-title");

        let datesEmployed = '';
        if (datesEmployedElement) {
          datesEmployed = datesEmployedElement.text().trim();
        }
        console.log('dates:' + datesEmployed + ' isPositionCurrent(datesEmployed):' + isPositionCurrent(datesEmployed));
        if (isPositionCurrent(datesEmployed)) {
          if (titleElement) {
            title = titleElement.text().trim();
          }

          if (companyElement) {
            comp = companyElement.text().trim();
            // Contains hidden 'Company'
            comp = comp.substring(13, comp.length).trim();
          }

          let job = {
            title: title,
            company: comp,
          };
          jobs.push(job);
        }
      });
    }

    if (allJobs.length > 0) {
      jobsDetected = true;
    }

    // Load jobs in a dropdown
    if (jobsDetected && jobInterval) {
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
  if (jobs.length === 0) {
    jobsHTML += '<option value="">No current positions</option>';
  } else {
    if (jobs.length > 1) {
      jobsHTML += '<option value="">Please select a position</option>';
    }
    for (let j = 0; j < jobs.length; j++) {
      jobsHTML += '<option value="' + j + '">' + jobs[j].title + ' - ' + jobs[j].company + '</option>';
    }
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
    let nameElement = document.querySelector('.profile-topcard-person-entity__name');
    if (nameElement) {
      result.name = nameElement.innerHTML.trim();
      let nameSplit = splitName(result.name);
      result.firstName = nameSplit.firstName;
      result.lastName = nameSplit.lastName;
    }
  }
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    let nameElement = document.querySelector('.pv-top-card-section__name');
    if (nameElement) {
      result.name = nameElement.innerHTML.trim();
      let nameSplit = splitName(result.name);
      result.firstName = nameSplit.firstName;
      result.lastName = nameSplit.lastName;
    }
  }
  if (pageType === PAGETYPE_RECRUITER) {
    if (data) {
      result.name = data.fullName;
      result.firstName = data.firstName;
      result.lastName = data.lastName;
    } else {
      console.log('getName: recruiter data not initialised');
    }
    /* result.name = $('.info-container').find('.profile-info').find('h1').text().trim();
    console.log('result.name:' + result.name);
    let nameSplit = splitName(result.name);
    result.firstName = nameSplit.firstName;
    result.lastName = nameSplit.lastName; */
  }

  return result;
}

function getLinkedInFromUrl(url) {
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
    console.log('get linkedIn for Sales Navigator');

    // now we trigger the LinkedIn default onclick
    document.querySelector('.copy-linkedin').click();

    // remove ugly popup that shows that we've copied that url
    setTimeout(function(){
      document.querySelector('artdeco-toasts').style.display = 'none';
    }, 50);

    // Get the linkedIn address which has been written to this hidden element
    linkedIn = document.querySelector('#linkedin-paste').innerText;
    console.log('linkedIn is ' + linkedIn);

    return linkedIn;
  }

  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    linkedIn = getLinkedInFromUrl(url);
  }

  if (pageType === PAGETYPE_RECRUITER) {
    linkedIn = data.publicLink;
  }

  // Remove trailing slash
  if (linkedIn && linkedIn.slice(-1) === '/') {
    linkedIn = linkedIn.substring(0, linkedIn.length - 1);
  }

  return linkedIn;
}

const parseJsonIfPossible = (rawJson) => {
  try {
    return JSON.parse(rawJson);
  } catch (e) {
    console.log('error parsing data:' + e);
    return {};
  }
};

// Gets the LinkedIn data in JSON format and loads it into global var data
function initData() {
  console.log('doing initData');
  const codes = document.querySelectorAll('code');
  console.log('codes: ' + codes.length);

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

function initRecruiterData() {
  // Captured as soon as page loads
  if (recruiterProfileData) {
    // Remove comments in first and last characters
    if (recruiterProfileData.substr(0, 4) === '<!--' &&  recruiterProfileData.substr(-3) === '-->') {
      recruiterProfileData = recruiterProfileData.substring(4, recruiterProfileData.length - 3);
    }
    try {
      data = JSON.parse(recruiterProfileData);
    } catch (e) {
      console.log('parsing failed'); // for ' + recruiterProfileData + '. Now try with decoding.');
      data = parseJsonIfPossible(decodeURIComponent(recruiterProfileData));
    }
    data = data.profile;
    console.log(data);
  }
}

function changeSelectEducation(educationId) {
  console.log('changeSelectEducation for ' + educationId);
  if (iFrameDOM.find('#education' + educationId + '-select').is(':checked')) {
    iFrameDOM.find('#education' + educationId + '-degree').removeAttr('disabled');
    iFrameDOM.find('#education' + educationId + '-field-of-study').removeAttr('disabled');
    iFrameDOM.find('#education' + educationId + '-institution').removeAttr('disabled');
  } else {
    iFrameDOM.find('#education' + educationId + '-degree').attr('disabled', 'disabled');
    iFrameDOM.find('#education' + educationId + '-field-of-study').attr('disabled', 'disabled');
    iFrameDOM.find('#education' + educationId + '-institution').attr('disabled', 'disabled');
  }
}

function getEducations() {
  if(data.educations) {
    educationsMap = new Map();
    for (let e = 0; e < data.educations.length; e++) {
      const education = data.educations[e];
      const newEducation = {  educationId: (pageType === PAGETYPE_RECRUITER ? education.educationId : education.eduId),
                              degree: education.degree,
                              fieldOfStudy: education.fieldOfStudy,
                              institution: education.schoolName,
                              startDateYear: education.startDateYear,
                              endDateYear: education.endDateYear };
      if (education.startedOn) {
        newEducation.startDate = { year: education.startedOn.year, month: education.startedOn.month, day: education.startedOn.day };
      }
      if (education.endedOn) {
        newEducation.endDate = { year: education.endedOn.year, month: education.endedOn.month, day: education.endedOn.day };
      }
      // Set educationId key as string
      educationsMap.set('' + newEducation.educationId, newEducation);
    }
  }

  let html  = '';
  educationsMap.forEach(function (education, key, map) {
    html += '<div class="education">';
    html += ' <input type="hidden" class="education-id" value="' + education.educationId + '"/>';
    html += '  <div class="form-check">';
    html += '    <input type="checkbox" data-education-id="' + education.educationId + '" class="form-check-input education-select" id="education' + key + '-select"  checked="checked"/>';
    html += '    <label for="education' + key + '-select" class="form-check-label">Select</label>';
    html += '  </div>';
    html += '  <div>';
    html += '    <div class="form-row">';
    html += '      <div class="col-4">';
    html += '    <label for="education' + key + '-degree">Degree</label>';
    html += '        <input type="text" class="form-control education-degree" id="education' + key + '-degree" value="' + (education.degree || '') + '" />';
    html += '      </div>';
    html += '      <div class="col-8">';
    html += '       <label for="education' + key + '-field-of-study">Field of Study</label>';
    html += '        <input type="text" class="form-control education-degree" id="education' + key + '-field-of-study" value="' + (education.fieldOfStudy || '') + '" />';
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="form-group">';
    html += '    <label for="educations' + key + '-institution">Institution</label>';
    html += '    <input type="text" class="form-control education-institution" id="education' + key + '-institution" value="' + (education.institution || '') + '"/>';
    // Only show dates if at least start date or end date is filled in
    if (education.startDateYear || education.endDateYear) {
      html += '    <small class="form-text text-muted">' + (education.startDateYear || '') + ' - ' + (education.endDateYear || '') + '</small>';
    }
    html += '  </div>';
    html += '</div>';
  });

  iFrameDOM.find('#educations').html(html);
}

function changeSelectPosition(positionId) {
  console.log('changeSelectPosition for ' + positionId);
  if (iFrameDOM.find('#position' + positionId + '-select').is(':checked')) {
    iFrameDOM.find('#position' + positionId + '-title').removeAttr('disabled');
    iFrameDOM.find('#position' + positionId + '-company').removeAttr('disabled');
  } else {
    iFrameDOM.find('#position' + positionId + '-title').attr('disabled', 'disabled');
    iFrameDOM.find('#position' + positionId + '-company').attr('disabled', 'disabled');
  }
}

function getPositions() {
  if (data.positions) {
    positionsMap = new Map();
    for (let p = 0; p < data.positions.length; p++) {
      const position = data.positions[p];
      const newPosition = { positionId: (pageType === PAGETYPE_RECRUITER ? position.positionId : position.posId),
                            current: position.current,
                            title: position.title,
                            companyName: position.companyName,
                            description: position.description,
                            location: position.location };

      if (position.startedOn) {
        newPosition.startDate = { year: position.startedOn.year, month: position.startedOn.month, day: position.startedOn.day };
      }
      if (position.endedOn) {
        newPosition.endDate = { year: position.endedOn.year, month: position.endedOn.month, day: position.endedOn.day };
      }
      // Set positionId key as string
      positionsMap.set('' + newPosition.positionId, newPosition);
    }
  }

  let html  = '';
  positionsMap.forEach(function (position, key, map) {
    html += '<div class="position">';
    html += ' <input type="hidden" class="position-id" value="' + position.positionId + '" />';
    html += '  <div class="form-check">';
    html += '    <input type="checkbox" data-position-id="' + position.positionId + '" class="form-check-input position-select" id="position' + key + '-select" checked="checked"/>';
    html += '    <label for="position' + key + '-select" class="form-check-label">Select</label>';
    html += '  </div>';
    html += '  <div class="form-group">';
    html += '    <label for="positions' + key + '-title">Title</label> ';
    html += position.current ? '<span class="badge badge-info">Current</span>' : '<span class="badge badge-light">Past</span>';
    html += '    <input type="text" class="form-control position-title" id="position' + key + '-title" value="' + position.title + '" />';
    html += '  </div>';
    html += '  <div class="form-group">';
    html += '    <label for="positions' + key + '-company">Company</label>';
    html += '    <input type="text" class="form-control position-company" id="position' + key + '-company" value="' + position.companyName + '"/>';
    html += '    <small class="form-text text-muted">' +  (position.startDateYear || '') + ' - ' + (position.endDateYear || '') + (position.location ? ' | ' + position.location : '') + '</small>';
    html += '  </div>';
    html += '</div>';
  });

  iFrameDOM.find('#positions').html(html);
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
  let state = '';
  let country = '';
  let linkedIn = '';
  let phone = '';
  let email = '';
  let website = '';
  let twitter = '';

  let dutch = '';
  let english = '';
  let french = '';
  let german = '';

  let phones = [];
  let emails = [];
  let websites = [];
  let twitters = [];
  educations = [];

  let url = window.location.href;
  console.log('url:' + url);
  console.log('data: ' + JSON.stringify(data));
  console.log('pageType: ' + pageType);


  if (pageType === PAGETYPE_RECRUITER) {
    console.log('Processing Recruiter Profile');

    // name
    name = data.fullName;
    firstName = data.firstName;
    lastName = data.lastName;

    // location
    location = data.location;
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    country = locationSplit.country;
    state = locationSplit.state;

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

    // Languages
    if (data.languages) {
      for (let l = 0; l < data.languages.length; l++) {
        const language = data.languages[l];
        console.log('language.languageName:' + language.languageName);
        // LanguageName is a free text field in LinkedIn
        switch (language.languageName) {
          case 'English':
          case 'Engels':
            english = language.proficiency;
            break;

          case 'French':
          case 'Frans':
            french = language.proficiency;
            break;

          case 'German':
          case 'Duits':
            german = language.proficiency;
            break;

          case 'Dutch':
          case 'Nederlands':
            dutch = language.proficiency;
            break;
        }
      }
    }

    // Educations
    getEducations();

    // Positions
    getPositions();

  } else if (pageType === PAGETYPE_SALES_NAVIGATOR) {
    let nameResult = getName();
    name = nameResult.name;
    firstName = nameResult.firstName;
    lastName = nameResult.lastName;

    let locationElement = document.querySelector('.profile-topcard__location-data');
    location = (locationElement ? $(locationElement).text().trim() : '');
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    state = locationSplit.state;
    country = locationSplit.country;

    let contactInfoElement = document.querySelector('.profile-topcard__contact-info');
    if (contactInfoElement) {
      $(contactInfoElement).find('.mv2').each(function(index, infoLine) {
        let infoLineHTML = $(infoLine).html();
        if (infoLineHTML.indexOf('type="mobile-icon"') > -1 || infoLineHTML.indexOf('type="phone-handset-icon"') > -1) {
          phone = $(infoLine).find('a').text().trim();
        }
        if (infoLineHTML.indexOf('type="envelope-icon"') > -1) {
          email = $(infoLine).find('a').text().trim();
        }
        if (infoLineHTML.indexOf('type="link-icon"') > -1) {
          website = $(infoLine).find('a').text().trim();
        }
        if (infoLineHTML.indexOf('type="twitter-icon"') > -1) {
          twitter = $(infoLine).find('a').text().trim();
        }
      });
    }

    // LinkedIn
    linkedIn = getLinkedIn();

    // Jobs
    jobInterval = setInterval(getJobs, 1000);

  } else if (pageType ===  PAGETYPE_REGULAR_LINKEDIN) {
    console.log('processing regular LinkedIn profile');

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
    state = locationSplit.state;
    country = locationSplit.country;

    // LinkedIn
    linkedIn = getLinkedIn(url);

    // Jobs
    jobInterval = setInterval(getJobs, 1000);

  } else if (pageType === PAGETYPE_GMAIL) {
    console.log('processing Gmail');

    nameElements = $('.gD');
    if (nameElements.length > 0) {
      // Take the latest one
      const nameElement = $(nameElements[nameElements.length - 1]);
      name = nameElement.text().trim();

      let nameSplit = splitName(name);
      firstName = nameSplit.firstName;
      lastName = nameSplit.lastName;

      email = nameElement.attr('email');
    }
  }



  /* if (!nameElement) {
    nameInterval = setInterval(refillForm, 1000);
  } */

  // Set default values of fields
  for (let f = 0; f < FIELDS.length; f++) {
    if (FIELDS[f].defaultValue) {
      if (FIELDS[f].type === FIELDTYPE_CHECKBOX) {
        if (FIELDS[f].defaultValue === 'true') {
          iFrameDOM.find('#' + FIELDS[f].name).prop('checked', true);
        }
      } else {
        iFrameDOM.find('#' + FIELDS[f].name).val(FIELDS[f].defaultValue);
      }
    }
  }


  // Load the LinkedIn data into the the form
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
  createRemoveAreaLink();

  if (iFrameDOM.find('#state')) {
    iFrameDOM.find('#state').val(state);
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

  if (iFrameDOM.find('#english')) {
    iFrameDOM.find('#english').val(english);
  }

  if (iFrameDOM.find('#french')) {
    iFrameDOM.find('#french').val(french);
  }

  if (iFrameDOM.find('#german')) {
    iFrameDOM.find('#german').val(german);
  }

  if (iFrameDOM.find('#dutch')) {
    iFrameDOM.find('#dutch').val(dutch);
  }

}

function createForm() {
  let html = '';
  html += '<form id="form">';
  let isTitleRequired = false;
  let isCompanyRequired  = false;

  if (FIELDS) {
    let nameShown = false;
    for (let f = 0; f < FIELDS.length; f++) {
      // We set isXXXrequired fields here while looping through the fields, but generate them later
      if (FIELDS[f].name === 'title' && FIELDS[f].required) {
        isTitleRequired = true;
      }
      if (FIELDS[f].name === 'company' && FIELDS[f].required) {
        isCompanyRequired = true;
      }

      if (FIELDS[f].name === 'firstName' || FIELDS[f].name === 'lastName') {
        if (!nameShown) {
          html += '<div class="form-row">';
          html += ' <div class="col">';
          html += '  <label for="firstName">First Name</label>';
          html += '  <input type="text" class="form-control" id="firstName" name="firstName" />';
          html += ' </div>';
          html += ' <div class="col">';
          html += '  <label for="lastName">Last Name</label>';
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
          if (FIELDS[f].name === FIELDNAME_CITY) {
            html += '<small class="form-text text-muted pull-right" id="remove-area"></small>';
          }
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
            // Empty option
            html += '  <option value=""></option>';
            for (let v = 0; v < FIELDS[f].picklistValues.length; v++) {
              html += '  <option value="' + FIELDS[f].picklistValues[v].value + '">' + FIELDS[f].picklistValues[v].label + '</option>';
            }
          }
          html += '  </select>';
        }
        if (FIELDS[f].type === FIELDTYPE_CHECKBOX) {
          html += ' <div class="form-check">';
          html += '  <input type="checkbox" class="form-check-input" id="' + FIELDS[f].name + '" name="' + FIELDS[f].name + '"/>';
          html += '  <label for="' + FIELDS[f].name + '" class="form-check-label">' + FIELDS[f].label + '</label>';
          html += ' </div>'
        }
        html += '</div>';
      }
    }
  }

  if (edition === EDITION_BUSINESS_DEVELOPER) {
    html += '<h3>Current Positions</h3>';
    html += '<div id="jobs">Scroll down to load jobs</div>';
    html += '<div class="form-group">';
    html += '  <label for="title">Title</label>';
    html += '  <input type="text" class="form-control" id="title" name="title" ' + (isTitleRequired ? 'required="required"' : '') + ' />';
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
    html += '      <input type="text" class="form-control company-input" id="company-name-contact" readonly ' + (isCompanyRequired ? 'required="required"' : '') + '/>';
    html += '    </div>';
    html += '    <input type="hidden" id="company-id-contact" />';
    html += '  </div>';
    html += '  <div id="search-company-popup" class="collapse shadow">';
    html += '    <div class="input-group mb-0" id="search-company-popup-input-row">';
    html += '      <input type="text" id="search-company-query" class="form-control" placeholder="Company name" ' + (isCompanyRequired ? 'required="required"' : '') + '/>';
    html += '      <span class="input-group-btn">';
    html += '        <button type="button" id="search-company-submit-button" class="btn btn-primary">' + SEARCH_COMPANY_SUBMIT_BUTTON_LABEL + '</button>';
    html += '      </span>';
    html += '    </div>';
    html += '    <div id="search-company-results">';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    html += '<br/>';
  }
  if (edition === EDITION_RECRUITER) {
    html += '<br/>';
    html += '<h3>Positions</h3>';
    html += '<div id="positions"></div>';
    html += '<br/>';
    html += '<h3>Educations</h3>';
    html += '<div id="educations"></div>';
    html += '<br/>';
  }
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
  html += '<button type="submit" id="submit-button" class="btn btn-primary">' + submitButtonLabel() + '</button>';
  html += '</form>';

  return html;
}

function submitButtonLabel() {
  return 'Save To ' + backendSystemName;
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
  html += '.btn-primary {';
  html += '  background-color: ' + darkColor + ';';
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
  html += 'div.position {';
  html += '  margin-top: 15px;';
  html += '  margin-bottom: 35px;';
  html += '}';
  html += 'div.education {';
  html += '  margin-top: 15px;';
  html += '  margin-bottom: 35px;';
  html += '}';
  /* html += '*, ::after, ::before {';
  html += '  box-sizing: border-box;';
  html += '}'; */
  html += '.collapse {';
  html += '  display: block;';
  html += '  padding: 0px;';
  html += '  max-height: 0px;';
  html += '  overflow: hidden;';
  html += '  transition: max-height 0.5s cubic-bezier(0, 1, 0, 1);';
  html += '}';
  html += '.collapse.show {';
  html += '  padding: 10px;';
  html += '  max-height: 99em;';
  html += '  transition: max-height 0.5s ease-in-out;';
  html += '}';
  html += '#logout-button { float: left; }';
  html += '#minimize-button { float: right; }';
  html += '#job-selector { background: #fff; }';
  html += '#back-button { float: left; }'
  html += '#minimize-button { float: right; }';
  html += '.link-contact { margin-top: 15px; }';
  html += '.card { margin-top: 5px; }';
  html += '#submit-error-message { display: none; }';
  html += '#submit-success-message { display: none; }';
  html += 'input:valid { border-bottom: 1px solid green; }';
  html += 'input:invalid { border-bottom: 1px solid red; }';
  html += '#search-company-popup { border-radius: 4px; border: 1px solid #ccc; margin-top: -1px;}';
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
  // html += '<script src="' + bootstrapJSURL +'"/>';
  html += '</body>';
  html += '</html>';

  return html;
}

function createContactSidebar(contact, contacts, linkedIn, name, profilePictureURL) {
  let isProfilePage = (pageType === PAGETYPE_SALES_NAVIGATOR || pageType === PAGETYPE_REGULAR_LINKEDIN || pageType === PAGETYPE_RECRUITER);
  let objectPlural = (mode === SAVEAS_MODE_LEAD ? 'leads' : 'contacts') ;
  let objectSingular = (mode === SAVEAS_MODE_LEAD ? 'lead' : 'contact');

  const createCreateContactButton = (linkedIn, objectSingular, isProfilePage) => {
    if (isProfilePage) {
      return '<a class="btn btn-primary" href="!#" id="create-contact-button">Create ' + objectSingular + '</a>';
    } else {
      return '<a class="btn btn-primary" href="' + linkedIn + '" target="_blank">Go to profile and create ' + objectSingular + '</a>';
    }
  };

  let html = '';
  html += '<img id="profile-picture" src="' + profilePictureURL + '" class="mx-auto d-block"/>';
  html += '<br/>';
  html += '<h2 class="text-center">' + name + '</h2>';
  html += '<p class="text-center">';
  if (!isProfilePage) {
    html += '<a href="' + linkedIn + '" target="_blank" class="btn btn-light">View LinkedIn Profile</a>';
  }
  if (contact) {
    html += '<a href="' + contact.link + '" target="_blank" class="btn btn-light" style="margin-left: 10px;">View in ' + backendSystemName + '</a>';
  }
  html += '</p>';

  if (contact) {
    html += '<p>';
    html += 'Title: ' + replateNullWithNA(contact.title) + '<br/>';
    html += 'Company: ';
    if (contact.companyLink) {
      html += '      <a href="' + contact.companyLink + '" target="_blank">';
    }
    html += contact.company;
    if (contact.companyLink) {
      html += '      </a>';
    }
    html += "</p>";
    if (isProfilePage) {
      html += '<button class="btn btn-primary" id="open-form-button">Open Form</button>';
    }
    html += '<br/><br/><h4>Recent Activity</h4>';
    html += '<div id="tasks">Loading...</div>';
  }
  if (contacts) {
    if (contacts.length === 0) {
      html += '<p>We did not find any ' + objectPlural + ' with the name <b>' + name + '</b> in ' + backendSystemName + '.</p>';
      if (pageType === PAGETYPE_LINKEDIN_MESSAGING) {
        html += '<small class="form-text text-muted">Contacts need to be saved in ' + backendSystemName + ' and linked to the LinkedIn profile before messages can be saved related to them.</small>';
      }
      html += '<br/><br/>';
      html += '<p class="text-center">';
      html += createCreateContactButton(linkedIn, objectSingular, isProfilePage);
      html += '</p>';
    } else {
      html += 'We found one or more ' + objectPlural + ' in ' + backendSystemName + ' with this name, which are <b>not linked</b> to this LinkedIn profile:<br/><br/>';

      for (let c = 0; c < contacts.length; c++) {
        html += '<div class="card">';
        html += '  <h6 class="card-header"><a href="' + contacts[c].link + '" target="_blank">' + contacts[c].name + '</a></h6>';
        html += '  <div class="card-body">';
        html += '    <p class="card-text">';
        html += '      Title: ' + contacts[c].title + '<br/>';
        html += '      Company: ';
        if (contacts[c].companyLink) {
          html += '      <a href="' + contacts[c].companyLink + '" target="_blank">';
        }
        html += contacts[c].company;
        if (contacts[c].companyLink) {
          html += '      </a>';
        }
        html += '     <br/>';
        html += '      <a class="btn btn-primary link-contact" href="!#" id="' + contacts[c].id + '">' + LINK_CONTACT_BUTTON_LABEL + '</a>';
        html += '    </p>';
        html += '  </div>';
        html += '</div>';
      }
      html += '<br/><br/>';
      html += createCreateContactButton(linkedIn, objectSingular, isProfilePage);
      html += '<div id="link-contact-error" class="alert alert-danger" style="display: none"></div>';
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
  html += '  <div class="alert alert-danger" id="login-error-message" style="display: none"></div>';
  html += '  <button type="submit" class="btn btn-primary">Log In</button>';
  html += ' </form>';
  html += ' <br/>';
  html += ' <a href="https://app.leadexporter.io/register" target="_blank">I don\'t have an account yet</a><br/>';
  html += ' <a href="https://app.leadexporter.io/recover-password" target="_blank">I forgot my password</a>';

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

  // Get all elements in the form and put them in an array
  const valuesArray = [];
  valuesArray.push(['linkedIn', linkedIn]);

  const postData = { valuesArray,
                     mode,
                     contactId,
                     userId,
                     apiKey };

  // iFrameDOM.find('#submit-button').html('<i class="fa fa-circle-o-notch fa-spin"></i> Saving...');
  iFrameDOM.find('#link-contact-error').css('display', 'none');
  iFrameDOM.find('#link-contact-error').text('');
  $.post(SERVER_URL + '/contact/update', postData, (result) => {
    // Reset button
    iFrameDOM.find('#' + contactId).html(LINK_CONTACT_BUTTON_LABEL);
    if (result.success) {
      loadFrameContent();
    } else {
      iFrameDOM.find('#link-contact-error').css('display', 'block');
      iFrameDOM.find('#link-contact-error').text('Linking failed: ' + result.error);
    }
    /* iFrameDOM.find('#submit-button').html(SUBMIT_BUTTON_LABEL);
    if (result.success) {
      showSuccessMessage('Record successfully created: <a href="' + result.link + '" target="_blank">' + result.name + '</a>');
    } else {
      showErrorMessage('Record creation failed: ' + result.error);
    } */
  });
}

function getSelectedPositions() {
  const positions = [];

  iFrameDOM.find('.position').each((index, position) => {
    if ($(position).find('.form-check-input').is(':checked')) {
      // Get position details from map
      const positionId = $(position).find('.position-id').val();
      const newPosition = positionsMap.get(positionId);
      // Overwrite title and companyname with values from inputs
      newPosition.title = $(position).find('.position-title').val();
      newPosition.companyName = $(position).find('.position-company').val();
      positions.push(newPosition);
    }
  });

  return positions;
}

function getSelectionEducations() {
  const educations = [];

  iFrameDOM.find('.education').each((index, education) => {
    if ($(education).find('.form-check-input').is(':checked')) {
      // Get education details from map
      const educationId = $(education).find('.education-id').val();
      const newEducation = educationsMap.get(educationId);
      // Overwrite degree and institution with values from inputs
      newEducation.degree = $(education).find('.education-degree').val();
      newEducation.institution = $(education).find('.education-institution').val();
      educations.push(newEducation);
    }
  });

  return educations;
}

function submit() {
  console.log('submit');

  const saveAs = mode; // getSaveAsMode();

  // Get most input elements in the form and put them in an array
  const valuesArray = [];
  iFrameDOM.find('.form-control').each((index, field) => {
    if (!$(field).hasClass('position-title') &&
      !$(field).hasClass('position-company') &&
      !$(field).hasClass('education-degree') &&
      !$(field).hasClass('education-institution') &&
      $(field).val()) {

      console.log('mapping ' + $(field).prop('id') + ' to ' + $(field).val());
      valuesArray.push([$(field).prop('id'), $(field).val()]);
    }
  });

  // Get checkbox elements in the form and put them in an array
  iFrameDOM.find('.form-check-input').each((index, field) => {
    console.log('mapping ' + $(field).prop('id') + ' to ' + $(field).is(":checked"));
    valuesArray.push([$(field).prop('id'), $(field).is(":checked")]);
  });

  valuesArray.push(['company', (saveAs === SAVEAS_MODE_LEAD ? getCompanyName() : iFrameDOM.find('#company-id-contact').val())]);

  // Get selected positions
  valuesArray.push(['positions', getSelectedPositions()]);

  // Get selected educations
  valuesArray.push(['educations', getSelectionEducations()]);

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
    iFrameDOM.find('#submit-button').html(submitButtonLabel());
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
            // $(this).tab('show');
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

// map our commands to the classList methods
const fnmap = {
  'toggle': 'toggle',
    'show': 'add',
    'hide': 'remove'
};

// Custom collapse function
const collapse = (selector, cmd) => {
  const targets = Array.from(iFrameDOM.find(selector));
  targets.forEach(target => {
    target.classList[fnmap[cmd]]('show');
  });
}

function selectCompanyResult(companyId, companyName) {
  console.log('selected companyId:' + companyId + ' companyName:' + companyName);
  iFrameDOM.find('#search-company-results').html('');
  iFrameDOM.find('#company-name-contact').val(companyName);
  iFrameDOM.find('#company-id-contact').val(companyId);

  // Close the popup
  collapse('#search-company-popup', 'hide');
}

function openSearchCompanyPopup() {
  console.log('openSearchCompanyPopup');
  collapse('#search-company-popup', 'toggle');
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
  $('#task-message-' + whoId + '-' + i).html('<b>Saving...</b>');
  $.post(SERVER_URL + '/task', postData, (result) => {
    console.log('result from creating task:' + JSON.stringify(result));
    $('#task-message-' + whoId + '-' + i).html(createTaskSavedLink(result.success, result.error, result.link));
    loadTasks();
  });
}

function createTaskSavedLink(saveSuccessful, error, link) {
  if (saveSuccessful) {
    return '<a href="' + link + '" target="_blank" style="color:green">Task saved</a>';
  } else {
    return '<div style="color:red">Save failed:' + error + '</div>';
  }
}

function createTaskLink(messageGroup, i, taskExists, recordLink) {
  // Create the link and the event binder
  let link;
  if (taskExists) {
    link = '<div id="task-message-' + whoId + '-' + i + '" class="task-message" style="margin-left: 10px;">' + createTaskSavedLink(recordLink) + '</div>';
  } else {
    link = '<div id="task-message-' + whoId + '-' + i + '" class="task-message" style="margin-left: 10px;"><a id=\"create-task-' + whoId + '-' + i + '\" data-counter="' + i + '" href=\"!#\">Create task</a></div>';
  }

  // Remove any other existing links
  $(messageGroup).find('.msg-s-message-group__meta').find('.task-message').each((index, link) => {
    link.parentNode.removeChild(link);
  });
  $(messageGroup).find('.msg-s-message-group__meta').html($(messageGroup).find('.msg-s-message-group__meta').html() + link);
  $('#create-task-' + whoId + '-' + i).on('click', function (e) {
    e.preventDefault();

    // Get the counter of the element that's clicked
    const counter = $(this).attr('data-counter');
    console.log('counter is:' + counter);
    createTask(MESSAGES[counter - 1], counter);
  });
}

function createMessageTaskLink(tasks, tasksWithoutSpaces, tempMessage, messageGroup, i, addToMessages) {
  console.log('createMessageTaskLink for ' + i + ' tempMessage:' + tempMessage);
  let taskExists = false;
  let taskLink = '';
  let taskMatchCounter = tasksWithoutSpaces.indexOf(tempMessage.replace(/\s/g,''));
  if (taskMatchCounter > -1) {
    console.log('MESSAGE EXISTS!' + tempMessage);
    taskExists = true;
    taskLink = tasks[taskMatchCounter].link;
  }

  if (tempMessage) {
    // Create link for last line
    createTaskLink(messageGroup, i, taskExists, taskLink);

    if (addToMessages) {
      // Save this message
      MESSAGES.push(tempMessage);
    }
  }
}

function createMessageTaskLinks(tasks) {

  if (numberOfMessageItems !== $('.msg-s-event-listitem').length) {
    // Remove existing links
    var paras = document.getElementsByClassName('task-message');
    while (paras[0]) {
      paras[0].parentNode.removeChild(paras[0]);
    };

    console.log('number of messages has changed');
    numberOfMessageItems = $('.msg-s-event-listitem').length;
    let profileLink;
    let profileURL;
    let author;
    let tempMessage = '';
    let message = '';
    let previousMessageGroup;
    let tasksWithoutSpaces = [];
    MESSAGES = [];

    if (tasks) {
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t];
        if (task.description) {
          tasksWithoutSpaces.push(task.description.replace(/\s/g,''));
        }
      }
      console.log('tasksWithoutSpaces:' + JSON.stringify(tasksWithoutSpaces));
    }

    let i = 0;

    $('.msg-s-event-listitem').each((index, messageGroup) => {

      profileLink = $(messageGroup).find('.msg-s-message-group__profile-link');
      profileURL = profileLink.prop('href');
      author = profileLink.text().trim();
      message = $(messageGroup).find('.msg-s-event-listitem__body').text().trim();

      if (message) {
        // if no author is printed: belongs to previous author
        if (!author && index !== (numberOfMessageItems - 1)) {
          // Add messages together if they are from the same author
          tempMessage += (tempMessage ? '\n' : '') + message;
        } else {
          createMessageTaskLink(tasks, tasksWithoutSpaces, tempMessage, previousMessageGroup, i, true);

          // Start new message
          tempMessage = message;
          i++;
        }
      }

      // For the last line (needs to be outside of if (message){} logic as last message can be connection request confirmation which is no message)
      if (index === (numberOfMessageItems - 1)) {
        if (author) {
          const messageGroupToShowLinkFor = (message ? messageGroup : previousMessageGroup);
          console.log('with author: for last message: message:' + message + ' tempMessage:' + tempMessage);
          createMessageTaskLink(tasks, tasksWithoutSpaces, tempMessage, messageGroupToShowLinkFor, i, true);
        } else {
          const lastMessage = MESSAGES[MESSAGES.length - 1] + '\n' + tempMessage;
          MESSAGES[MESSAGES.length - 1] = lastMessage;
          const messageGroupToShowLinkFor = (message ? messageGroup : previousMessageGroup);
          console.log('no author: for last message: message:' + message + ' tempMessage:' + tempMessage);
          // Note: the i we pass is the count of the last message in the array, since i itself could be higher if there are multiple rows from same author
          createMessageTaskLink(tasks, tasksWithoutSpaces, lastMessage, previousMessageGroup, MESSAGES.length, false);
        }
      }

      console.log('MESSAGES:' + MESSAGES);

      // Store the last messageGroup with the name of the person, since that's where we want to add the link
      if (profileLink.text().trim()) {
        previousMessageGroup = messageGroup;
      }

    });
  } else {
    // console.log('number of conversations checked and the same');
  }
}

function removeArea() {
  let city = iFrameDOM.find('#city').val();
  for (let a = 0; a < AREAS.length; a++) {
    city = city.replace(AREAS[a], '');
  }

  iFrameDOM.find('#city').val(city);
}

function createRemoveAreaLink() {
  const city = iFrameDOM.find('#city').val();
  if (city) {
    // See if any variation of 'area' is found in the city
    let matchingArea = '';
    for (let a = 0; a < AREAS.length; a++) {
      if (city.indexOf(AREAS[a]) > -1) {
        matchingArea = AREAS[a];
        break;
      }
    }

    if (matchingArea) {
      // Create the link
      iFrameDOM.find('#remove-area').html('<a href="!#">Remove \'' + matchingArea.trim() + '\'</a>');
    }
  }

}

function populateForm() {
  console.log('populateForm');
  // NO NEED TO EXECUTE THIS BEFORE THE FORM IS LOADED?
  const postData = { userId, apiKey };
  $.post(SERVER_URL + '/fields', postData, (result) => {
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
      iFrameDOM.find('.position-select').each(function(index, select) {
        $(select).change(changeSelectPosition($(select).attr('data-position-id')));
        // select.addEventListener("change", );
      });
      iFrameDOM.find('.education-select').each(function(index, select) {
        $(select).change(changeSelectEducation($(select).attr('data-education-id')));
        // select.addEventListener("change", );
      });


      iFrameDOM.find('#form').submit((event) => {
        // Prevent reloading the page
        event.preventDefault();
        submit();
      });
      iFrameDOM.find('#open-search-company-form-button').click(() => {
        openSearchCompanyPopup();
      });
      iFrameDOM.find('#search-company-query').keypress((event) => {
         // Since it's a nested form we cannot use submit: fake submit behaviour by accepting enter as a submit
         if (event.keyCode === 13 || event.which === 13) {
           event.preventDefault();
           searchCompany();
         }
      });
      iFrameDOM.find('#search-company-submit-button').click(searchCompany);
      iFrameDOM.find('#remove-area').click((event) => {
        event.preventDefault();

        removeArea();
      });
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
  html += 'After successful authorization, just refresh this page and you\'ll be good to go.<br/><br/>';
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

  if (pageType === PAGETYPE_RECRUITER) {
    if (data) {
      // take the 200x200 shrink
      if (data && data.vectorImage && data.vectorImage.artifacts && data.vectorImage.artifacts.length >= 2) {
        return data.vectorImage.rootUrl + data.vectorImage.artifacts[1].fileIdentifyingUrlPathSegment;
      } else {
        console.log('something went wrong getting vectorImage');
      }
    } else {
      console.log('getProfilePictureURL: data not initialized');
    }
  }

  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    pictureElement = $('.pv-top-card-section__photo');
    if (pictureElement.length > 0) {
      return getBackgroundImageURLFromElement(pictureElement);
    } else {
      // User visits his own profile
      pictureElement = $('.profile-photo-edit__preview');
      return pictureElement.prop('src');
    }
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
  html += '<div id="loading-content">';
  html += '  <img id="loading-picture" src="' + loadingImageURL + '" class="mx-auto d-block"/>';
  html += '  <p class="text-center">Just a sec...</p>';
  html += '</div>';

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

    // Loading indicator on button
    iFrameDOM.find('#' + contactId).html('<i class=\'fa fa-spinner fa-spin\'></i> Working hard...');

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

  const getProfilePictureFromMessageGroup = (messageGroup) => {
    let profilePictureURL;

    let authorPictureElement = $(messageGroup).find('.presence-entity__image');
    if (authorPictureElement.length === 0) {
      authorPictureElement = $(messageGroup).find('.msg-facepile-grid__img--person');
    }
    if (authorPictureElement.length > 0) {
      profilePictureURL = getBackgroundImageURLFromElement(authorPictureElement);
    }

    return profilePictureURL;
  };


  // Get image from active conversation
  let activeConversationsSelector = $('.msg-conversation-listitem__link.active');
  if (activeConversationsSelector.length > 0) {
    $(activeConversationsSelector).each((index, messageGroup) => {
      profilePictureURL = getProfilePictureFromMessageGroup(messageGroup);
    });
  } else {
    console.log('no active conversations');
    // Looks like there is always an active conversation, it may just not be visible yet
    // If no conversation is marked as active (because user loaded the page on this conversation):
    // Check the href from the conversations to see which one is the current page
    // This will only work for the visible conversations
    /* $('.msg-conversation-listitem__link').each((index, messageGroup) => {
      console.log('$(messageGroup).href' + $(messageGroup).attr('href'));
      if ($(messageGroup).attr('href') === currentURL) {
        console.log('active url');
        profilePictureURL = getProfilePictureFromMessageGroup(messageGroup);
      }
    }); */
  }

  return profilePictureURL;
}

function populateTasksInContactSidebar(tasks) {
  if (tasks) {
    let html = '';
    if (tasks.length > 0) {
      for (let t = 0; t < tasks.length; t++) {
        html += '<div class="card">';
        html += ' <div class="card-header">';
        html += '  <div class="pull-left"><a href="' + tasks[t].link + '" target="_blank">' + tasks[t].subject + '</a></div><div class="pull-right">' + tasks[t].date + '</div><div class="clearfix"></div></div>';
        html += '  <div class="card-body">';
        html += '    <p class="card-text">' + tasks[t].description + '</p>';
        html += '  </div>';
        html += '</div>';
      }
    } else {
      html += '<p>No recent activity</p>';
    }
    iFrameDOM.find('#tasks').html(html);
  }
}

function loadTasks(cb) {
  const postData = { whoId,
                     userId,
                     apiKey,
                     limit: 3 };
  $.post(SERVER_URL + '/tasks', postData, (result) => {
    console.log('/tasks result:' + JSON.stringify(result));
    if (result.success) {
      const tasks = result.tasks;
      populateTasksInContactSidebar(tasks);

      if (pageType === PAGETYPE_LINKEDIN_MESSAGING) {
        createMessageTaskLinks(tasks);
      }

      if (typeof cb === 'function') {
        cb(tasks);
      }
    }
  });
}

function doContactSearch(linkedIn, name, profilePictureURL, userId, apiKey ) {
  console.log('doContactSearch for linkedIn:' + linkedIn + ' name:' + name);
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
      edition = result.edition;
      backendSystemName = result.backendSystemName;

      if (contact) {
        whoId = (contact ? contact.id : null );
      }

      populateContactSidebar(contact, contacts, linkedIn, name, profilePictureURL);

      if (whoId) {
        loadTasks((tasks) => {
          if (pageType === PAGETYPE_LINKEDIN_MESSAGING) {
            // Keep checking if the number of messages has changed since new messages could have been sent or just loaded by going further back into the conversation
            createMessageTaskLinksInterval = setInterval(() => {
              createMessageTaskLinks(tasks);
            }, 1000);
          }
        });
      }

    } else {
      console.log('request failed: ' + result.errorNr + ' ' + result.error);
      if (result.errorNr === 403) {
        populateLoginForm();
      } else {
        iFrameDOM.find('#loading-content').html('<div class="alert alert-danger">Error: ' + result.error + '</div>');
      }
    }
  })
  // Handle connection failures
  .fail(function(xhr, status) {
    let error;
    if (xhr.status === 0) {
      error = 'Cannot connect.';
    } else {
      error = xhr.statusText;
    }
    iFrameDOM.find('#loading-content').html('<div class="alert alert-danger">Error connecting to LeadExporter.io: ' + error + '</div>');
  })
}

function loadFrameContent(urlHasChanged) {
  jobsDetected = false;
  whoId = null;
  clearInterval(jobInterval);
  clearInterval(createMessageTaskLinksInterval);
  numberOfMessageItems = 0;

  console.log('userId:' + userId + ' apiKey:' + apiKey);
  if (userId && apiKey) {

    // Determine page type
    //       "matches": ["*://*.linkedin.com/in/*", "*://*.linkedin.com/sales/people/*", "*://*.linkedin.com/messaging/*"],
    pageType = '';
    if (currentURL.indexOf('/sales/people') > -1) {
      // LinkedIn Sales Navigator page
      pageType = PAGETYPE_SALES_NAVIGATOR;
    } else if (currentURL.indexOf('linkedin.com/in/') > -1){
      // Regular LinkedIn page
      pageType = PAGETYPE_REGULAR_LINKEDIN;
    } else if (currentURL.indexOf('linkedin.com/recruiter/profile') > -1) {
      // LinkedIn Recruiter page
      pageType = PAGETYPE_RECRUITER;
    } else if (currentURL.indexOf('/mail.google.com/mail/u/0/?shva=1#inbox/') > -1) {
      // Gmail
      pageType = PAGETYPE_GMAIL;
    } else if (currentURL.indexOf('/messaging') > -1) {
      // InMail mailbox
      pageType = PAGETYPE_LINKEDIN_MESSAGING;
    }
    console.log('currentURL:' + currentURL + ' pageType:' + pageType);

    if (pageType) {
      maximize();

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

        doContactSearch(linkedIn, name, profilePictureURL, userId, apiKey);

        if (!profilePictureURL) {
          let getProfilePictureFromMessagingPageInterval = setInterval(() => {
            console.log('doing interval');
            profilePictureURL = getProfilePictureFromMessagingPage();



            // We found an image which is not the LinkedIn provided dummy image
            if (profilePictureURL && profilePictureURL !== 'https://static.licdn.com/sc/h/djzv59yelk5urv2ujlazfyvrk') {
              iFrameDOM.find('#profile-picture').attr('src', profilePictureURL);
              console.log('clearing interval');
              clearInterval(getProfilePictureFromMessagingPageInterval);
            } else {
              console.log('setting temp image');
              // Temporarily set dummy image
              if (iFrameDOM.find('#profile-picture').attr('src') !== faceImageURL) {
                iFrameDOM.find('#profile-picture').attr('src', faceImageURL);
              }
            }
          }, 1000);
        }
      } else if (pageType === PAGETYPE_RECRUITER) {
        console.log('getting recruiter info');
        initRecruiterData();
        name = getName().name;
        profilePictureURL = getProfilePictureURL();
        linkedIn = getLinkedIn();

        doContactSearch(linkedIn, name, profilePictureURL, userId, apiKey);
      } else if (pageType === PAGETYPE_SALES_NAVIGATOR || pageType === PAGETYPE_REGULAR_LINKEDIN) {
        const finishGettingData = (name) => {
          profilePictureURL = getProfilePictureURL();
          linkedIn = getLinkedIn(currentURL);
          doContactSearch(linkedIn, name, profilePictureURL, userId, apiKey);
        };

        // If we don't get a result for name yet, try again, may still be loading
        name = getName().name;
        if (!name) {
          let nameInterval = setInterval(() => {
            console.log('checking for name');
            name = getName().name;
            console.log('name: ' + name);
            if (name) {
              console.log('clearing interval');
              clearInterval(nameInterval);
              finishGettingData(name);
            }
          }, 200);
        } else {
          finishGettingData(name);
        }
      }
    } else {
      // User visits a page on which we don't want to show the extension, eg. the Notifications page on LinkedIn
      minimize();
    }
  } else {
    populateLoginForm();
  }
}

function checkURLchange(){
  // console.log('check URL change');
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
  // Capture recruiter profile data as soon as page loads as it is removed later on
  recruiterProfileData = $('code#profile-data').html();

  // logout();
  console.log('document ready, start loading');
  chrome.storage.sync.get('userId', function(userIdObj) {
    chrome.storage.sync.get('apiKey', function(apiKeyObj) {
      userId = userIdObj.userId;
      apiKey = apiKeyObj.apiKey;

      // Avoid recursive frame insertion...
      var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
      if (!location.ancestorOrigins.contains(extensionOrigin)) {
        let frameId = 'leadexporter-frame';
        // Create iFrame
        iframe = document.createElement('iframe');
        iframe.id = frameId;
        iframe.style.cssText = 'position:fixed;top:0;right:0;display:block;' +
                               'width:' + IFRAME_WIDTH_MAXIMIZED + 'px;height:100%;z-index:1000; border-left: 1px solid #ccc; background-color: white;';
        document.body.appendChild(iframe);

        // Create script to overwrite copy function
        let htmlScript = `const command = document.execCommand;

                          var h = document.createElement("div");
                          h.style.cssText = 'display:none;';
                          h.id = 'linkedin-paste';
                          document.body.appendChild(h);

                          document.execCommand = function(method) {
                            // Check if copy command is used
                            if (method == 'copy') {
                              const copied = window.getSelection().toString();
                              // Check if the text copied is a valid Profile url
                              if(copied.indexOf('linkedin.com/in/') > -1){
                                console.log('I copied ' + copied);
                                document.querySelector('#linkedin-paste').innerText = copied;
                              }
                            }

                            // Trigger default function
                            command(method);
                          };`;
        let script = document.createElement('script');
        script.innerHTML = htmlScript;
        document.body.appendChild(script);

        iFrameDOM = $("iframe#" + frameId).contents();

        // Create head, css and menu for the iframe
        let html = createFrameTemplate();
        iframe.contentDocument.body.innerHTML = '';
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();

        // Event handlers for menu items
        // iFrameDOM.find('[data-toggle="tooltip"]').tooltip(); // To make this work, "js/popper.min.js", "js/bootstrap.min.js" needs to be in web_accessible_resources
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
