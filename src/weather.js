const LATITUDE = -25.5407;
const LONGITUDE = 152.7049;
const UPDATE_INTERVAL = 600000;
const CACHE_DURATION = Infinity;

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

let lastWeatherData = null;
let lastFetchTime = 0;
let isFetching = false;

async function updateWeather(retryCount = 0) {

  if (isFetching) return;
  
  if (lastWeatherData) {
    displayWeather(lastWeatherData);
    return;
  }

  try {
    isFetching = true;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,weather_code&temperature_unit=celsius`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const temp = data.current.temperature_2m;
    const weatherCode = data.current.weather_code;
    
    lastWeatherData = { temp, weatherCode };
    lastFetchTime = Date.now();
    isFetching = false;
    
    displayWeather(lastWeatherData);
  } catch (error) {
    isFetching = false;

    if (lastWeatherData) {
      displayWeather(lastWeatherData);
    } else {
      document.getElementById("weather-emoji").innerText = "?";
      document.getElementById("weather-temp").innerText = "--°C";
    }
  }
}

function displayWeather(data) {
  try {
    const temp = Math.round(data.temp);
    const emoji = weatherCodeToEmoji[data.weatherCode] || "🌡️";

    document.getElementById("weather-emoji").innerText = emoji;
    document.getElementById("weather-temp").innerText = `${temp}°C`;
  } catch (error) {
    document.getElementById("weather-emoji").innerText = "?";
    document.getElementById("weather-temp").innerText = "--°C";
  }
}

updateWeather();
setInterval(updateWeather, UPDATE_INTERVAL);
