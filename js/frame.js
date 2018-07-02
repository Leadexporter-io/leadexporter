console.log('loading frame.js!');
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM content loaded!");
  document.getElementById("jobSelector").addEventListener("change", changeJob);
});
