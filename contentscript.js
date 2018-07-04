const PAGETYPE_SALES_NAVIGATOR = 'Sales Navigator';
const PAGETYPE_REGULAR_LINKEDIN = 'Regular LinkedIn';

let jobs = [];

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
  var iFrameDOM = $("iframe#linkedforce-frame").contents();

  iFrameDOM.find("#title").val(title);
  iFrameDOM.find("#company").val(company);
}

function changeJob() {
  console.log('job changed');
  var iFrameDOM = $("iframe#linkedforce-frame").contents();
  let jobSelectorElements = iFrameDOM.find('#job-selector');
  if (jobSelectorElements.length > 0) {
    let jobNumber = $(jobSelectorElements[0]).val();
    console.log(jobNumber);
    loadJob(jobs[jobNumber].title, jobs[jobNumber].company);
  }

}

/* returns array with active jobs from the elements to analyse */
function analyzeRegularLinkedInPageJobs(allJobs){
  const jobs = [];
  $.each(allJobs, function(index, job) {
    let jobDetails = $(job).find(".pv-entity__summary-info");
    $.each(jobDetails, function (index, jobDetail) {
      let jobDetailText = $(jobDetail).text();
      console.log('jobDetailText:' + jobDetailText);
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

  let phone = '';
  let email = '';
  let website = '';
  let twitter = '';

  let url = window.location.href;
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


  if (url.indexOf('/sales/people') > -1) {
    // LinkedIn Sales Navigator page
    pageType = PAGETYPE_SALES_NAVIGATOR;

    let nameElement = document.querySelector('.profile-topcard-person-entity__name');
    name = (nameElement ? nameElement.innerHTML.trim() : '');

    let nameSplit = splitName(name);
    firstName = nameSplit.firstName;
    lastName = nameSplit.lastName;

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
        if (infoLineHTML.indexOf('type="mobile-icon"') > -1) {
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

  } else {
    // Regular LinkedIn page
    pageType = PAGETYPE_REGULAR_LINKEDIN;

    let nameElement = document.querySelector('.pv-top-card-section__name');
    name = (nameElement ? nameElement.innerHTML.trim() : '');

    let nameSplit = splitName(name);
    firstName = nameSplit.firstName;
    lastName = nameSplit.lastName;

    // let headlineElement = document.querySelector('.pv-top-card-section__headline');
    // headline = (headlineElement ? headlineElement.innerHTML.trim() : '');

    let locationElement = document.querySelector('.pv-top-card-section__location');
    location = (locationElement ? locationElement.innerHTML.trim() : '');
    let locationSplit = splitLocation(location);
    city = locationSplit.city;
    country = locationSplit.country;

    // let summaryElement = document.querySelector('.pv-top-card-section__summary-text');
    // summary = (summaryElement ? summaryElement.innerHTML.trim() : '');
  }





  // let html = 'Name:' + name + '<br/>headline:' + headline + '<br/>location:' + location;

  let bootstrapCSSURL = chrome.extension.getURL("css/bootstrap.min.css");
  let bootstrapJSURL = chrome.extension.getURL("js/bootstrap.min.js");
  let jqueryURL = chrome.extension.getURL("js/jquery-3.3.1.min.js");

  function getJobs() {
    jobs = [];
    let allJobs;
    // Collect the jobs from the page
    if (pageType === PAGETYPE_REGULAR_LINKEDIN) {
      console.log('checking for jobs on regular linkedIn page');
      allJobs = $("#experience-section").find(".pv-profile-section__sortable-card-item");
      console.log('allJobs sortable cards');
      console.log(allJobs);
      jobs = jobs.concat(analyzeRegularLinkedInPageJobs(allJobs));
      allJobs = $("#experience-section").find(".pv-profile-section__card-item");
      jobs = jobs.concat(analyzeRegularLinkedInPageJobs(allJobs));
      console.log('allJobs cards');
      console.log(allJobs);
    } else {
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

    console.log(JSON.stringify(jobs));

    // Load jobs in a dropdown
    if (jobs.length !== 0 && jobInterval) {
      let jobsHTML = '<select id="job-selector">';
      if (jobs.length > 1) {
        jobsHTML += '<option value="">Please select a job</option>';
      }
      for (let j = 0; j < jobs.length; j++) {
        jobsHTML += '<option value="' + j + '">' + jobs[j].title + ' - ' + jobs[j].company + '</option>';
      }
      jobsHTML += '</select>';
      var iFrameDOM = $("iframe#linkedforce-frame").contents();
	    iFrameDOM.find("#jobs").html(jobsHTML);
      let jobSelectorElements = iFrameDOM.find('#job-selector');
      if (jobSelectorElements.length > 0) {
        console.log('adding eventlistener');
        jobSelectorElements[0].addEventListener("change", changeJob);
      }

      if (jobs.length === 1) {
        loadJob(jobs[0].title, jobs[0].company);
      }

      // Stop checking if the jobs section is loaded
      clearInterval(jobInterval);
    }
  }

  // if (pageType = PAGETYPE_REGULAR_LINKEDIN) {
  let jobInterval = setInterval(getJobs, 1000);
  // }


  let html = '<!DOCTYPE html><html><head>';
  html += '<link rel="stylesheet" href="' + bootstrapCSSURL + '" />';
  html += '<style>';
  html += 'body {';
  html += '  margin: 0;';
  html += '  right: 0;';
  html += '  border: 1px;';
  html += '  padding: 5px;';
  html += '  display: block;';
  html += '  width: 100vw;';
  html += '  height: 100vh;';
  html += '  background: white;';
  html += '  color: black;';
  html += '}';
  html += '</style>';
  html += '</head><body>';
  html += '<h2>Copy Contact</h2>';
  html += '<form>';
  html += '<label>Name</label>';
  html += '<div class="row">';
  html += ' <div class="col">';
  html += '  <input type="text" class="form-control" id="firstName" value="' + firstName + '" />';
  html += ' </div>';
  html += ' <div class="col">';
  html += '  <input type="text" class="form-control" id="lastName" value="' + lastName + '" />';
  html += ' </div>';
  html += '</div>';
  html += '<small class="form-text text-muted">Full name: ' + name + '</small>';
  /* html += '<div class="form-group">';
  html += '  <label for="headline">Headline</label>';
  html += '  <input type="text" class="form-control" id="headline" value="' + headline + '">';
  html += '</div>'; */
  html += '<div class="form-group">';
  html += '  <label for="phone">Phone</label>';
  html += '  <input type="text" class="form-control" id="phone" value="' + phone + '">';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="email">E-mail</label>';
  html += '  <input type="text" class="form-control" id="email" value="' + email + '">';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="website">Website</label>';
  html += '  <input type="text" class="form-control" id="website" value="' + website + '">';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="twitter">Twitter</label>';
  html += '  <input type="text" class="form-control" id="twitter" value="' + twitter + '">';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="city">City</label>';
  html += '  <input type="text" class="form-control" id="city" value="' + city + '">';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="country">Country</label>';
  html += '  <input type="text" class="form-control" id="country" value="' + country + '">';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="linkedIn">LinkedIn</label>';
  html += '  <input type="text" class="form-control" id="linkedIn" value="' + linkedIn + '">';
  html += '</div>';
  html += '<h3>Current Jobs</h3>';
  html += '<div id="jobs">Scroll down to load jobs</div>';
  html += '<div class="form-group">';
  html += '  <label for="title">Title</label>';
  html += '  <input type="text" class="form-control" id="title" value="' + title + '">';
  html += '</div>';
  html += '<div class="form-group">';
  html += '  <label for="company">Company</label>';
  html += '  <input type="text" class="form-control" id="company" value="' + company + '">';
  html += '</div>';
  html += '<br/>';
  html += '<div class="form-check form-check-inline">';
  html += ' <input class="form-check-input" type="radio" name="saveAs" id="saveAsLead" value="lead" checked>';
  html += ' <label class="form-check-label" for="saveAsLead">Lead</label>';
  html += '</div>';
  html += '<div class="form-check form-check-inline">';
  html += ' <input class="form-check-input" type="radio" name="saveAs" id="saveAsContact" value="contact">';
  html += ' <label class="form-check-label" for="saveAsContact">Contact</label>';
  html += '</div>';
  html += '<br/>';
  html += '<button type="submit" class="btn btn-primary">Save To CRM</button>';
  html += '</form>';
  // html += '<script src="' + jqueryURL + '"></script>';
  // html += '<script src="' + bootstrapJSURL + '"></script>';
  html += '<script src="js/frame.js">';
  html += '</body>';
  html += '</html>';
  console.log(html);

  return html;
  // return '';
}

// Avoid recursive frame insertion...
var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
if (!location.ancestorOrigins.contains(extensionOrigin)) {
    var iframe = document.createElement('iframe');

    const html = extractInContentScript();

    iframe.src = chrome.runtime.getURL('frame.html');
    iframe.id = 'linkedforce-frame';

    // Some styles for a fancy sidebar
    iframe.style.cssText = 'position:fixed;top:0;right:0;display:block;' +
                           'width:470px;height:100%;z-index:1000;';

    document.body.appendChild(iframe);

    iframe.contentDocument.write(html);
}
