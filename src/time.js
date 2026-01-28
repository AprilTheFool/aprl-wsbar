function updateClock() {
  const now = new Date();

  // Hours in 12-hour format
  let hours = now.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  const minutes = String(now.getMinutes()).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const dateString = `${day}/${month}`;
  const timeString = `${hours}:${minutes} ${ampm}`;

  document.getElementById("clock").innerText = `${timeString}`;
  document.getElementById("date").innerText = `${dateString}`;
}

// Update every second
setInterval(updateClock, 1000);
updateClock();
