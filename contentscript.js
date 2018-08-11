let pageType;
const PAGETYPE_SALES_NAVIGATOR = 'Sales Navigator';
const PAGETYPE_REGULAR_LINKEDIN = 'Regular LinkedIn';
const PAGETYPE_GMAIL = 'Gmail';
const PAGETYPE_LINKEDIN_MESSAGING = 'LinkedIn Messaging';
const IFRAME_WIDTH_MINIMIZED = 50;
const IFRAME_WIDTH_MAXIMIZED = 470;
const SERVER_URL = 'http://localhost:10/api';
const SAVEAS_MODE_LEAD = 'lead';
const SAVEAS_MODE_CONTACT = 'contact';
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
const jqueryURL = chrome.extension.getURL("js/jquery-3.3.1.min.js");
const fontAwesomeCSSURL = chrome.extension.getURL("fonts/font-awesome-4.7.0/css/font-awesome.min.css");
const loadingImageURL = chrome.extension.getURL("img/loading.gif");
var apiKey;
var userId;
let jobInterval;
let nameInterval;
let whoId;

let jobs = [];
var iframe;
var iFrameDOM;
var oldURL;
var currentURL;

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
  let saveAsMode = iFrameDOM.find('input[name=save-as]:checked').val();
  console.log('switch to ' + saveAsMode + ' mode');
  if (saveAsMode === 'lead') {
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
function refillForm() {
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
}

function nameElementLoaded() {
  const salesNavigatorNameElement = document.querySelector('.profile-topcard-person-entity__name');
  const linkedInNameElement = document.querySelector('.pv-top-card-section__name');
  return (salesNavigatorNameElement || linkedInNameElement);
}

function getJobs() {
  console.log('getJobs');
  jobs = [];
  let allJobs;
  // Collect the jobs from the page
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    // console.log('checking for jobs on regular linkedIn page');
    allJobs = $("#experience-section").find(".pv-profile-section__sortable-card-item");
    jobs = jobs.concat(analyzeRegularLinkedInPageJobs(allJobs));
    allJobs = $("#experience-section").find(".pv-profile-section__card-item");
    jobs = jobs.concat(analyzeRegularLinkedInPageJobs(allJobs));
  } else {
    // console.log('checking for jobs on Sales Navigator page');
    allJobs = $("#profile-experience").find(".profile-position");
    $.each(allJobs, function(index, job) {

      let datesEmployedElement = $(job).find(".profile-position__dates-employed");
      let titleElement = $(job).find(".profile-position__title");
      let companyElement = $(job).find(".profile-position__secondary-title");

      let datesEmployed = '';
      if (datesEmployedElement) {
        datesEmployed = datesEmployedElement.text().trim();
      }

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

  // Load jobs in a dropdown
  if (jobs.length !== 0 && jobInterval) {
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

    // Stop checking if the jobs section is loaded
    clearInterval(jobInterval);
  }
}

function getName() {
  let nameElement;
  let result = {};

  // Sales Navigator format
  if (pageType === PAGETYPE_SALES_NAVIGATOR ) {
    nameElement = document.querySelector('.profile-topcard-person-entity__name');
    result.name = nameElement.innerHTML.trim();
  }
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    nameElement = document.querySelector('.pv-top-card-section__name');
    result.name = nameElement.innerHTML.trim();
  }

  let nameSplit = splitName(result.name);
  result.firstName = nameSplit.firstName;
  result.lastName = nameSplit.lastName;

  return result;
}

// Gets the LinkedIn address from the url
function getLinkedIn(url) {
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

  let url = window.location.href;
  console.log('url:' + url);
  let nameElement;


  const codes = document.querySelectorAll('code');
  let data;

  console.log('codes:' + JSON.stringify(codes));

  const parseJsonIfPossible = (rawJson) => {
    try {
      return JSON.parse(rawJson);
    } catch (e) {
      return {};
    }
  };

  for (let i = 0; i < codes.length; i += 1) {
    let code = parseJsonIfPossible(decodeURIComponent(codes[i].innerText.trim()));
    if (code.fullName) {
      data = code;
      console.log('yeah!');
      // return false;
    }
  }

  console.log('data: ' + JSON.stringify(data));
  console.log('pageType: ' + pageType);

  name = data.fullName;
  firstName = data.firstName;
  lastName = data.lastName;

  if (pageType === PAGETYPE_SALES_NAVIGATOR) {
    console.log('Processing Sales Navigator');
    maximize();

    let nameResult = getName();
    // name = nameResult.name;
    // firstName = nameResult.firstName;
    // lastName = nameResult.lastName;
    name = data.fullName;
    firstName = data.firstName;
    lastName = data.lastName;

    // let headlineElement = document.querySelector('.pv-top-card-section__headline');
    // headline = (headlineElement ? headlineElement.innerHTML.trim() : '');

    let locationElement = document.querySelector('.profile-topcard__location-data');
    location = (locationElement ? $(locationElement).text().trim() : '');
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
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

  } else if (pageType === PAGETYPE_REGULAR_LINKEDIN){
    console.log('processing regular linkedIn');
    maximize();

    let nameResult = getName();
    name = nameResult.name;
    firstName = nameResult.firstName;
    lastName = nameResult.lastName;

    linkedIn = getLinkedIn(url);

    // let headlineElement = document.querySelector('.pv-top-card-section__headline');
    // headline = (headlineElement ? headlineElement.innerHTML.trim() : '');

    let locationElement = document.querySelector('.pv-top-card-section__location');
    location = (locationElement ? locationElement.innerHTML.trim() : '');
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    country = locationSplit.country;

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

  jobInterval = setInterval(getJobs, 1000);

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

  if (iFrameDOM.find('#title')) {
    iFrameDOM.find('#title').val(title);
  }

  if (iFrameDOM.find('#company')) {
    iFrameDOM.find('#company').val(company);
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
  let html = '<!DOCTYPE html><html><head>';
  html += '<link rel="stylesheet" href="' + bootstrapCSSURL + '" />';
  html += '<link rel="stylesheet" href="' + fontAwesomeCSSURL + '" />';
  html += '<style>';
  html += 'body {';
  html += '  margin: 0px;';
  html += '  padding-left: 10px;';
  html += '  right: 0;';
  html += '  display: block;';
  html += '  width: 93vw;';
  html += '  height: 100vh;';
  html += '  background: white;';
  html += '  color: black;';
  html += '}';
  html += '#job-selector { background: #fff; }';
  html += '#minimize-button { float: right; }';
  html += '#maximize-button { float: left; visibility: hidden; }';
  html += '#submit-error-message { display: none; }';
  html += '#submit-success-message { display: none; }';
  html += 'input:valid { border-bottom: 1px solid green; }';
  html += 'input:invalid { border-bottom: 1px solid red; }';
  html += '#search-company-popup { padding: 10px; border-radius: 4px; border: 1px solid #ccc; margin-top: -1px;}';
  html += '#search-company-query { border: 1px solid #ccc !important }'; // To avoid the query input having a green bar (coming from the 'valid' validation class)
  html += '</style>';
  html += '</head>';
  html += '<body>';
  html += '<a href="#"><i class="fa fa-window-minimize" aria-hidden="true" id="minimize-button"></i></a>';
  html += '<a href="#"><i class="fa fa-window-maximize" aria-hidden="true" id="maximize-button"></i></a>';
  html += '<br/>';
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

  html += '<h3>Current Jobs</h3>';
  html += '<div id="jobs">Scroll down to load jobs</div>';
  html += '<div class="form-group">';
  html += '  <label for="title">Title</label>';
  html += '  <input type="text" class="form-control" id="title" name="title" required/>';
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
  html += '<div class="form-check form-check-inline">';
  html += ' <input class="form-check-input" type="radio" name="save-as" id="save-as-lead" value="lead" checked />';
  html += ' <label class="form-check-label" for="save-as-lead">Lead</label>';
  html += '</div>';
  html += '<div class="form-check form-check-inline">';
  html += ' <input class="form-check-input" type="radio" name="save-as" id="save-as-contact" value="contact" />';
  html += ' <label class="form-check-label" for="save-as-contact">Contact</label>';
  html += '</div>';
  html += '<br/>';
  html += '<div id="submit-success-message" class="alert alert-success"></div>';
  html += '<div id="submit-error-message" class="alert alert-danger"></div>';
  html += '<button type="submit" id="submit-button" class="btn btn-primary">Save To CRM</button>';
  html += '</form>';
  html += '</body>';
  html += '</html>';

  return html;
}

function createContactSidebar(contact, contacts, linkedIn, name, profilePictureURL) {
  let isProfilePage = (pageType === PAGETYPE_SALES_NAVIGATOR || pageType === PAGETYPE_REGULAR_LINKEDIN);

  let html = '<!DOCTYPE html><html><head>';
  html += '<link rel="stylesheet" href="' + bootstrapCSSURL + '" />';
  html += '<style>';
  html += 'body {';
  html += '  margin: 0px;';
  html += '  padding-left: 10px;';
  html += '  right: 0;';
  html += '  display: block;';
  html += '  width: 93vw;';
  html += '  height: 100vh;';
  html += '  background: white;';
  html += '  color: black;';
  html += '}';
  html += '#profile-picture {';
  html += '  border-radius: 50%;';
  html += '  width: 200px;';
  html += '  height: 200px;';
  html += '}';
  html += '#minimize-button { float: right; }';
  html += '#maximize-button { float: left; visibility: hidden; }';
  html += '</style>';
  html += '</head>';
  html += '<body>';
  html += '<a href="#"><i class="fa fa-window-minimize" aria-hidden="true" id="minimize-button"></i></a>';
  html += '<a href="#"><i class="fa fa-window-maximize" aria-hidden="true" id="maximize-button"></i></a>';
  html += '<br/>';
  html += '<img id="profile-picture" src="' + profilePictureURL + '" class="mx-auto d-block"/>';
  html += '<br/>';
  html += '<h2 class="text-center">' + name + '</h2>';
  if (!isProfilePage) {
    html += '<p class="text-center"><a href="' + linkedIn + '" target="_blank">View LinkedIn Profile</a></p>';
  }
  if (contact) {
    html += '<p class="text-center"><a href="' + contact.link + '" target="_blank">View in Salesforce</a></p>';
    html += 'Title: ' + contact.title + '<br/>';
    html += 'Company: ' + contact.company;
    html += '<br/><br/><a class="btn btn-primary" id="open-form-button">Open Form</a>';
  }
  if (contacts) {
    if (contacts.length === 0) {
      html += 'We did not find any contacts with the name <b>' + name + '</b>.';
      html += '<br/><br/>';
      html += '<p class="text-center">';
      if (isProfilePage) {
        html += '<a class="btn btn-primary" href="!#" id="create-contact-button">Create contact</a>';
      } else {
        html += '<a class="btn btn-primary" href="' + linkedIn + '" target="_blank">Go to profile and create contact</a>';
      }
      html += '</p>';
    } else {
      html += 'We found one or more contacts in Salesforce with this name, which are <b>not linked</b> to this LinkedIn profile:<br/><br/>';
      for (let c = 0; c < contacts.length; c++) {
        html += '<a href="' + contacts[c].link + '" target="_blank">' + contacts[c].name + '</a>';
        html += '<a class="btn btn-primary link-contact" href="!#" id="' + contacts[c].id + '">Link to LinkedIn profile</a>';
        html += '<br/><br/>';
      }
    }
  }
  html += '</body>';
  html += '</html>';

  return html;
}

function createLoginForm() {
  let html = '<!DOCTYPE html><html><head>';
  html += '<link rel="stylesheet" href="' + bootstrapCSSURL + '" />';
  html += '<link rel="stylesheet" href="' + fontAwesomeCSSURL + '" />';
  html += '<style>';
  html += 'body {';
  html += '  margin: 0px;';
  html += '  padding-left: 10px;';
  html += '  right: 0;';
  html += '  display: block;';
  html += '  width: 93vw;';
  html += '  height: 100vh;';
  html += '  background: white;';
  html += '  color: black;';
  html += '}';
  html += '#minimize-button { float: right; }';
  html += '#maximize-button { float: left; visibility: hidden; }';
  html += '</style>';
  html += '</head>';
  html += '<body>';
  html += '<a href="#"><i class="fa fa-window-minimize" aria-hidden="true" id="minimize-button"></i></a>';
  html += '<a href="#"><i class="fa fa-window-maximize" aria-hidden="true" id="maximize-button"></i></a>';
  html += '<br/>';
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
  html += '</body>';
  html += '</html>';

  return html;
}

function showErrorMessage(message) {
  iFrameDOM.find('#login-error-message').text(message);
  iFrameDOM.find('#login-error-message').css('display', 'block');
}

function minimize() {
  console.log('minimizing extension');
  $(iframe).css('width', IFRAME_WIDTH_MINIMIZED + 'px');
  $(iframe).css('height', '40px')
  iFrameDOM.find('#maximize-button').css('visibility', 'visible');
  iFrameDOM.find('#minimize-button').css('visibility', 'hidden');
}

function maximize() {
  console.log('maximizing extension');
  $(iframe).css('width', IFRAME_WIDTH_MAXIMIZED + 'px');
  $(iframe).css('height', '100%');
  iFrameDOM.find('#minimize-button').css('visibility', 'visible');
  iFrameDOM.find('#maximize-button').css('visibility', 'hidden');
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

function getSaveAsMode() {
  return iFrameDOM.find('input[name=save-as]:checked').val();
}

function getCompanyName() {
  if (getSaveAsMode() === SAVEAS_MODE_LEAD) {
    return iFrameDOM.find('#company-name-lead').val();
  } else {
    return iFrameDOM.find('#company-name-contact').val();
  }
}

function linkContact(contactId, linkedIn) {
  console.log('linkedContact with contactId ' + contactId + ' and linkedIn:' + linkedIn);

  const saveAs = getSaveAsMode();

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

  const saveAs = getSaveAsMode();

  // Get all elements in the form and put them in an array
  const valuesArray = [];
  iFrameDOM.find('.form-control').each((index, field) => {
    console.log('mapping ' + $(field).prop('id') + ' to ' + $(field).val());
    // valuesMap.set($(field).prop('id'), $(field).val());
    valuesArray.push([$(field).prop('id'), $(field).val()]);
  });
  valuesArray.push(['company', (saveAs === SAVEAS_MODE_LEAD ? getCompanyName() : iFrameDOM.find('#company-id-contact').val())]);

  const postData = { valuesArray,
                     saveAs,
                     userId,
                     apiKey };

  console.log('postData:' + JSON.stringify(postData));

  hideMessages();
  iFrameDOM.find('#submit-button').html('<i class="fa fa-circle-o-notch fa-spin"></i> Saving...');

  $.post(SERVER_URL + '/submit', postData, (result) => {
    console.log(JSON.stringify(result));
    iFrameDOM.find('#submit-button').html(SUBMIT_BUTTON_LABEL);
    if (result.success) {
      showSuccessMessage('Record successfully created: <a href="' + result.link + '" target="_blank">' + result.name + '</a>');
    } else {
      showErrorMessage('Record creation failed: ' + result.error);
    }
  });
}

function login() {
  iFrameDOM.find('#login-error-message').css('display', 'block');

  const email = iFrameDOM.find('#email').val();
  const password = iFrameDOM.find('#password').val();
  const postData = { email, password };

  $.post(SERVER_URL + '/login', postData, (result) => {
    console.log(JSON.stringify(result));
    if (result.success) {
      console.log('successful login');
      chrome.storage.sync.set({'userId': result.userId}, function() {});
      chrome.storage.sync.set({'apiKey': result.apiKey}, function() {});
    } else {
      iFrameDOM.find('#login-error-message').text(result.error);
      iFrameDOM.find('#login-error-message').css('display', 'block');
    }
  });
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
    $.post(SERVER_URL + '/search-company', postData, (result) => {
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
  const html = createForm();
  iframe.contentDocument.body.innerHTML = '';
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  fillForm();

  // Add event listeners
  iFrameDOM.find('input[name=save-as]').each(function(index, radio) {
    radio.addEventListener("change", switchSaveAsMode);
  });
  iFrameDOM.find('#minimize-button').click(minimize);
  iFrameDOM.find('#maximize-button').click(maximize);
  // iFrameDOM.find('#submit-button').click(submit);
  iFrameDOM.find('#form').submit((event) => {
    // Prevent reloading the page
    event.preventDefault();
    submit();
  });
  iFrameDOM.find('#open-search-company-form-button').click(openSearchCompanyPopup);
  iFrameDOM.find('#search-company-query').keypress((event) => {
     // Since it's a nested form we cannot use submit: fake submit behvious by accepting enter as a submit
     if (event.keyCode === 13 || event.which === 13) {
       event.preventDefault();
       searchCompany();
     }
  });
  iFrameDOM.find('#search-company-submit-button').click(searchCompany);
}

function populateLoginForm() {
  const html = createLoginForm();
  iframe.contentDocument.body.innerHTML = '';
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  iFrameDOM.find('#minimize-button').click(minimize);
  iFrameDOM.find('#maximize-button').click(maximize);

  iFrameDOM.find('#login-form').submit((event) => {
    // Prevent reloading the page
    event.preventDefault();
    login();
  });
}

/* function waitTillNameIsLoaded(cb) {
  console.log('waitTillNameIsLoaded');
  let nameLoaded = nameElementLoaded();
  console.log('nameLoaded:' + nameLoaded);
  if (!nameLoaded) {
    var localNameInterval = setInterval(() => {
      console.log('checking if name is loaded');
      nameLoaded = nameElementLoaded();
      console.log('nameLoaded:' + nameLoaded);
      if (nameLoaded) {
        clearInterval(localNameInterval);
        if (typeof cb === 'function') {
          cb();
        }
      }
    }, 500);
  } else {
    if (typeof cb === 'function') {
      cb();
    }
  }
} */

function getProfilePictureURL() {
  console.log('doing getProfilePictureURL');
  let pictureElement;

  if (pageType === PAGETYPE_SALES_NAVIGATOR) {
    pictureElement = $('.entity-image.entity-size-6.person');
    return pictureElement.prop('src');
  }
  if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
    pictureElement = $('.pv-top-card-section__photo');
    console.log('element:' + pictureElement);
    return getBackgroundImageURLFromElement(pictureElement);
  }
}

function getBackgroundImageURLFromElement(pictureElement) {
  console.log(pictureElement);
  if (pictureElement) {
    let pictureURL = pictureElement.css('background-image');
    console.log('pictureURL:' + pictureURL);
    if (pictureURL) {
      pictureURL = pictureURL.substring(5, pictureURL.length - 2);
      return pictureURL;
    }
  }
}

function createLoadingSidebar() {
  let html = '<!DOCTYPE html><html><head>';
  html += '<link rel="stylesheet" href="' + bootstrapCSSURL + '" />';
  html += '<style>';
  html += 'body {';
  html += '  margin: 0px;';
  html += '  padding-left: 10px;';
  html += '  right: 0;';
  html += '  display: block;';
  html += '  width: 93vw;';
  html += '  height: 100vh;';
  html += '  background: white;';
  html += '  color: black;';
  html += '}';
  html += '</style>';
  html += '</head>';
  html += '<body>';
  html += '<br/><br/><br/>';
  html += '<img id="loading-picture" src="' + loadingImageURL + '" class="mx-auto d-block"/>';
  html += '<p class="text-center">Just a sec...</p>';
  html += '</body>';
  html += '</html>';

  return html;
}

function loadFrameContent() {
  if (userId && apiKey) {

    // Show sidebar with loading content while we're getting all data
    let html = createLoadingSidebar();

    iframe.contentDocument.body.innerHTML = '';
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();

    let linkedIn;
    let name;
    let profilePictureURL;

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

    if (pageType === PAGETYPE_LINKEDIN_MESSAGING) {
      linkedIn = $('.msg-thread__topcard-btn').prop('href');
      name = $('.msg-entity-lockup__entity-title').text().trim();

      // Walk through conversation messages, check which one is from the author, then get that persons picture
      $('.msg-s-event-listitem').each((index, messageGroup) => {
        const authorPictureElement = $(messageGroup).find('.msg-s-event-listitem__profile-picture');
        if (authorPictureElement.text().trim() === name) {
          profilePictureURL = getBackgroundImageURLFromElement(authorPictureElement);
          // Exit for (each) loop
          return false;
        }
      });
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

        console.log('linkedIn:' + linkedIn);

        html = createContactSidebar(contact, contacts, linkedIn, name, profilePictureURL);

        iframe.contentDocument.body.innerHTML = '';
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();

        iFrameDOM.find('#minimize-button').click(minimize);
        iFrameDOM.find('#maximize-button').click(maximize);
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


        if (currentURL.indexOf('/messaging') > -1) {
          const whoId = (contact ? contact.id : null );
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
        } else {
          const postData = { userId, apiKey };
          $.post(SERVER_URL + '/fields', postData, (result) => {
            console.log(JSON.stringify(result));
            if (result.success) {
              FIELDS = result.fields;
              FIELDNAMES = result.fieldNames;

              // Load the data in the iFrame
              // populateForm();
            }
          });
        }


      } else {
        console.log('request failed: ' + result.error);
      }
    });
  } else {
    populateLoginForm();
  }
}

function checkURLchange(currentURL){
    if(currentURL != oldURL){
      loadFrameContent();
      oldURL = currentURL;
    }

    oldURL = window.location.href;
    setInterval(function() {
        checkURLchange(window.location.href);
    }, 1000);
}

$(document).ready(function(){
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
                               'width:' + IFRAME_WIDTH_MAXIMIZED + 'px;height:100%;z-index:1000; border: 1px solid #ccc;';
        document.body.appendChild(iframe);

        iFrameDOM = $("iframe#" + frameId).contents();

        oldURL = window.location.href;
        currentURL = window.location.href;

        loadFrameContent();

        // Handle URL changes
        checkURLchange(currentURL);
      }

    });
  });
});
