const PAGETYPE_SALES_NAVIGATOR = 'Sales Navigator';
const PAGETYPE_REGULAR_LINKEDIN = 'Regular LinkedIn';
const PAGETYPE_GMAIL = 'Gmail';
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
let FIELDS;
let FIELDNAMES;

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
    country = locationSplit[1];
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

function extractInContentScript() {
  console.log('loading extract in content script');

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
  let pageType = '';
  let linkedIn = '';
  let phone = '';
  let email = '';
  let website = '';
  let twitter = '';

  let url = window.location.href;
  console.log('url:' + url);

  if (url.indexOf('/sales/people') > -1) {
    console.log('Processing Sales Navigator');
    maximize();
    // LinkedIn Sales Navigator page
    pageType = PAGETYPE_SALES_NAVIGATOR;

    let nameElement = document.querySelector('.profile-topcard-person-entity__name');
    if (nameElement) {
      name = nameElement.innerHTML.trim();

      let nameSplit = splitName(name);
      firstName = nameSplit.firstName;
      lastName = nameSplit.lastName;
    }

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

  } else if (url.indexOf('linkedin.com/in/') > -1){
    console.log('processing regular linkedIn');
    maximize();
    // Regular LinkedIn page
    pageType = PAGETYPE_REGULAR_LINKEDIN;

    let nameElement = document.querySelector('.pv-top-card-section__name');
    if (nameElement) {
      name = nameElement.innerHTML.trim();

      let nameSplit = splitName(name);
      firstName = nameSplit.firstName;
      lastName = nameSplit.lastName;
    }

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
    }

    // let headlineElement = document.querySelector('.pv-top-card-section__headline');
    // headline = (headlineElement ? headlineElement.innerHTML.trim() : '');

    let locationElement = document.querySelector('.pv-top-card-section__location');
    location = (locationElement ? locationElement.innerHTML.trim() : '');
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    country = locationSplit.country;

    // let summaryElement = document.querySelector('.pv-top-card-section__summary-text');
    // summary = (summaryElement ? summaryElement.innerHTML.trim() : '');
  } else if (url.indexOf('/mail.google.com/mail/u/0/?shva=1#inbox/') > -1) {
    console.log('processing Gmail');
    maximize();

    // Gmail
    pageType = PAGETYPE_GMAIL;

    let nameElements = $('.gD');
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

  let bootstrapCSSURL = chrome.extension.getURL("css/bootstrap.min.css");
  let bootstrapJSURL = chrome.extension.getURL("js/bootstrap.min.js");
  let jqueryURL = chrome.extension.getURL("js/jquery-3.3.1.min.js");
  let fontAwesomeCSSURL = chrome.extension.getURL("fonts/font-awesome-4.7.0/css/font-awesome.min.css");

  function getJobs() {
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

    // console.log(JSON.stringify(jobs));

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

  let jobInterval = setInterval(getJobs, 1000);


  let html = '<!DOCTYPE html><html><head>';
  html += '<link rel="stylesheet" href="' + bootstrapCSSURL + '" />';
  html += '<link rel="stylesheet" href="' + fontAwesomeCSSURL + '" />';
  html += '<style>';
  html += 'body {';
  html += '  margin: 0px;';
  html += '  padding-left: 10px;';
  html += '  right: 0;';
  // html += '  border: 0px;';
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
  // html += '#search-company-results { margin-top: 10px; }';
  // html += '#search-company-popup-input-row { margin-bottom: 0px; }';
  html += '</style>';
  html += '</head>';
  html += '<body>';
  html += '<a href="#"><i class="fa fa-window-minimize" aria-hidden="true" id="minimize-button"></i></a>';
  html += '<a href="#"><i class="fa fa-window-maximize" aria-hidden="true" id="maximize-button"></i></a>';
  html += '<br/>';
  // html += '<h2>Copy Contact</h2>';
  html += '<form id="form">';

  html += '<label>Name</label>';
  html += '<div class="form-row">';
  html += ' <div class="col">';
  html += '  <input type="text" class="form-control" id="firstName" name="firstName" value="' + firstName + '" required/>';
  html += ' </div>';
  html += ' <div class="col">';
  html += '  <input type="text" class="form-control" id="lastName" name="lastName" value="' + lastName + '" required/>';
  html += ' </div>';
  html += '</div>';
  html += '<small class="form-text text-muted" id="name">Full name: ' + name + '</small>';
  /* html += '<div class="form-group">';
  html += '  <label for="headline">Headline</label>';
  html += '  <input type="text" class="form-control" id="headline" value="' + headline + '">';
  html += '</div>'; */
  html += '<div class="form-group">';
  html += '  <label for="phone">Phone</label>';
  html += '  <input type="text" class="form-control" id="phone" name="phone" value="' + phone + '" />';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="email">E-mail</label>';
  html += '  <input type="email" class="form-control" id="email" name="email" value="' + email + '" />';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="website">Website</label>';
  html += '  <input type="text" class="form-control" id="website" name="website" value="' + website + '" />';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="twitter">Twitter</label>';
  html += '  <input type="text" class="form-control" id="twitter" name="twitter" value="' + twitter + '" />';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="city">City</label>';
  html += '  <input type="text" class="form-control" id="city" name="city" value="' + city + '" />';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="country">Country</label>';
  html += '  <input type="text" class="form-control" id="country" name="country" value="' + country + '" required/>';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="linkedIn">LinkedIn</label>';
  html += '  <input type="text" class="form-control" id="linkedIn" name="linkedIn" value="' + linkedIn + '" />';
  html += '</div>';

  if (FIELDS) {
    let nameShown = false;
    for (let f = 0; f < FIELDS.length; f++) {
      if (FIELDS[f].name === 'firstName' || FIELDS[f].name === 'lastName') {
        if (!nameShown) {
          html += '<label>Name</label>';
          html += '<div class="form-row">';
          html += ' <div class="col">';
          html += '  <input type="text" class="form-control" id="firstName" name="firstName" value="' + firstName + '" required/>';
          html += ' </div>';
          html += ' <div class="col">';
          html += '  <input type="text" class="form-control" id="lastName" name="lastName" value="' + lastName + '" required/>';
          html += ' </div>';
          html += '</div>';
          html += '<small class="form-text text-muted" id="name">Full name: ' + name + '</small>';

          nameShown = true;
        }
      } else {
        html += '<div class="form-group">';
        html += '  <label for="' + FIELDS[f].name + '">' + FIELDS[f].label + '</label>';
        html += '  <input type="' + FIELDS[f].type + '" class="form-control" id="' + FIELDS[f].name + '" name="' + FIELDS[f].name + '" ' + (FIELDS[f].required ? ' required="required"' : '') + '/>';
        html += '</div>';
      }
    }
  }

  html += '<h3>Current Jobs</h3>';
  html += '<div id="jobs">Scroll down to load jobs</div>';
  html += '<div class="form-group">';
  html += '  <label for="title">Title</label>';
  html += '  <input type="text" class="form-control" id="title" name="title" value="' + title + '" required/>';
  html += '</div>';
  html += '<div id="company-input">';
  html += '  <div class="form-group" id="company-input-lead">';
  html += '    <label for="company">Company</label>';
  html += '    <input type="text" class="form-control company-input" id="company-name-lead" value="' + company + '" />';
  html += '  </div>';
  html += '  <div class="form-group mb-0" id="company-input-contact" style="display: none">';
  html += '    <label for="company">Company</label>';
  html += '    <div class="input-group">';
  html += '      <div class="input-group-prepend">';
  html += '        <span class="input-group-text" id="open-search-company-form-button"><a href="#!"><i class="fa fa-search"></i></a></span>';
  html += '      </div>';
  html += '      <input type="text" class="form-control company-input" id="company-name-contact" value="' + company + '" readonly required />';
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

function fillForm() {
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
  let pageType = '';
  let linkedIn = '';
  let phone = '';
  let email = '';
  let website = '';
  let twitter = '';

  let url = window.location.href;
  console.log('url:' + url);

  if (url.indexOf('/sales/people') > -1) {
    console.log('Processing Sales Navigator');
    maximize();
    // LinkedIn Sales Navigator page
    pageType = PAGETYPE_SALES_NAVIGATOR;

    let nameElement = document.querySelector('.profile-topcard-person-entity__name');
    if (nameElement) {
      name = nameElement.innerHTML.trim();

      let nameSplit = splitName(name);
      firstName = nameSplit.firstName;
      lastName = nameSplit.lastName;
    }

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

  } else if (url.indexOf('linkedin.com/in/') > -1){
    console.log('processing regular linkedIn');
    maximize();
    // Regular LinkedIn page
    pageType = PAGETYPE_REGULAR_LINKEDIN;

    let nameElement = document.querySelector('.pv-top-card-section__name');
    if (nameElement) {
      name = nameElement.innerHTML.trim();

      let nameSplit = splitName(name);
      firstName = nameSplit.firstName;
      lastName = nameSplit.lastName;
    }

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
    }

    // let headlineElement = document.querySelector('.pv-top-card-section__headline');
    // headline = (headlineElement ? headlineElement.innerHTML.trim() : '');

    let locationElement = document.querySelector('.pv-top-card-section__location');
    location = (locationElement ? locationElement.innerHTML.trim() : '');
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    country = locationSplit.country;

    // let summaryElement = document.querySelector('.pv-top-card-section__summary-text');
    // summary = (summaryElement ? summaryElement.innerHTML.trim() : '');
  } else if (url.indexOf('/mail.google.com/mail/u/0/?shva=1#inbox/') > -1) {
    console.log('processing Gmail');
    maximize();

    // Gmail
    pageType = PAGETYPE_GMAIL;

    let nameElements = $('.gD');
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

  function getJobs() {
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

  let jobInterval = setInterval(getJobs, 1000);

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
  let bootstrapCSSURL = chrome.extension.getURL("css/bootstrap.min.css");
  let bootstrapJSURL = chrome.extension.getURL("js/bootstrap.min.js");
  let jqueryURL = chrome.extension.getURL("js/jquery-3.3.1.min.js");
  let fontAwesomeCSSURL = chrome.extension.getURL("fonts/font-awesome-4.7.0/css/font-awesome.min.css");

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
      } else {
        html += '<div class="form-group">';
        if (FIELDS[f].type === FIELDTYPE_TEXT || FIELDS[f].type === FIELDTYPE_NUMBER || FIELDS[f].type === FIELDTYPE_EMAIL) {
          html += '  <label for="' + FIELDS[f].name + '">' + FIELDS[f].label + '</label>';
          html += '  <input type="' + FIELDS[f].type + '" class="form-control" id="' + FIELDS[f].name + '" name="' + FIELDS[f].name + '" ' + (FIELDS[f].required ? ' required="required"' : '') + '/>';
        }
        if (FIELDS[f].type === FIELDTYPE_TEXTAREA) {
          html += '  <label for="' + FIELDS[f].name + '">' + FIELDS[f].label + '</label>';
          html += '  <textarea class="form-control" id="' + FIELDS[f].name + '" name="' + FIELDS[f].name + '" ' + (FIELDS[f].required ? ' required="required"' : '') + ' rows="3"></textarea>';
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
  html += '    <label for="company">Company</label>';
  html += '    <input type="text" class="form-control company-input" id="company-name-lead" />';
  html += '  </div>';
  html += '  <div class="form-group mb-0" id="company-input-contact" style="display: none">';
  html += '    <label for="company">Company</label>';
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

function submit() {
  console.log('submit');

  const saveAs = getSaveAsMode();

  const postData = {  firstName: iFrameDOM.find('#firstName').val(),
                      lastName: iFrameDOM.find('#lastName').val(),
                      phone: iFrameDOM.find('#phone').val(),
                      email: iFrameDOM.find('#email').val(),
                      website: iFrameDOM.find('#website').val(),
                      twitter: iFrameDOM.find('#twitter').val(),
                      city: iFrameDOM.find('#city').val(),
                      country: iFrameDOM.find('#country').val(),
                      linkedIn: iFrameDOM.find('#linkedIn').val(),
                      title: iFrameDOM.find('#title').val(),
                      company: (saveAs === SAVEAS_MODE_LEAD ? getCompanyName() : iFrameDOM.find('#company-id-contact').val()),
                      saveAs,
  };

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

function searchCompany() {

  // Get search query
  const q = iFrameDOM.find('#search-company-query').val();
  console.log('q:' + q);

  let resultsHTML = '';
  if (q) {
    // Loading indicator on submit button
    iFrameDOM.find('#search-company-submit-button').html('<i class=\'fa fa-search fa-spin\'></i>');

    // Submit request
    $.get(SERVER_URL + '/search-company?q=' + q, (result) => {
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

function populateForm() {
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

  /* iFrameDOM.find('#search-company-form').submit((event) => {
    // Prevent reloading the page
    event.preventDefault();
    searchCompany();
  }); */
}

function checkURLchange(currentURL){
    if(currentURL != oldURL){
        populateForm();
        oldURL = currentURL;
    }

    oldURL = window.location.href;
    setInterval(function() {
        checkURLchange(window.location.href);
    }, 1000);
}

$(document).ready(function(){
  console.log('document ready, start loading');
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

    // Add event listeners
    iFrameDOM = $("iframe#" + frameId).contents();

    $.get(SERVER_URL + '/fields', (result) => {
      console.log(JSON.stringify(result));
      if (result.success) {
        FIELDS = result.fields;
        FIELDNAMES = result.fieldNames;

        // Load the data in the iFrame
        populateForm();

        oldURL = window.location.href;
        currentURL = window.location.href;

        // Handle URL changes
        checkURLchange(currentURL);
      }
    });

  }
});
