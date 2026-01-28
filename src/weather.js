const LATITUDE = -25.5407;
const LONGITUDE = 152.7049;
const UPDATE_INTERVAL = 600000;

const weatherCodeToEmoji = {
  0: "☀️", // Clear sky
  1: "🌤️", // Mainly clear
  2: "⛅", // Partly cloudy
  3: "☁️", // Overcast
  45: "🌫️", // Fog
  48: "🌫️", // Depositing rime fog
  51: "🌦️", // Light drizzle
  53: "🌦️", // Moderate drizzle
  55: "🌧️", // Dense drizzle
  56: "🌨️", // Light freezing drizzle
  57: "🌨️", // Dense freezing drizzle
  61: "🌧️", // Slight rain
  63: "🌧️", // Moderate rain
  65: "🌧️", // Heavy rain
  66: "🌨️", // Light freezing rain
  67: "🌨️", // Heavy freezing rain
  71: "🌨️", // Slight snow
  73: "🌨️", // Moderate snow
  75: "❄️", // Heavy snow
  77: "🌨️", // Snow grains
  80: "🌦️", // Slight rain showers
  81: "🌧️", // Moderate rain showers
  82: "⛈️", // Violent rain showers
  85: "🌨️", // Slight snow showers
  86: "❄️", // Heavy snow showers
  95: "⛈️", // Thunderstorm
  96: "⛈️", // Thunderstorm with slight hail
  99: "⛈️", // Thunderstorm with heavy hail
};

async function updateWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,weather_code&temperature_unit=celsius`;
    const response = await fetch(url);
    const data = await response.json();

    const temp = Math.round(data.current.temperature_2m);
    const weatherCode = data.current.weather_code;
    const emoji = weatherCodeToEmoji[weatherCode] || "🌡️";

    document.getElementById("weather-emoji").innerText = emoji;
    document.getElementById("weather-temp").innerText = `${temp}°C`;
  } catch (error) {
    console.error("Failed to fetch weather:", error);
    document.getElementById("weather-emoji").innerText = "❓";
    document.getElementById("weather-temp").innerText = "--°C";
  }
}

updateWeather();
setInterval(updateWeather, UPDATE_INTERVAL);
