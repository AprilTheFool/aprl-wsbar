// weather widget uses open-meteo.com

// move lat/long to config at some point
const LATITUDE = -25.5407;
const LONGITUDE = 152.7049;
const UPDATE_INTERVAL = 600000; // 10 min
const CACHE_DURATION = Infinity;

const weatherCodeToEmoji = {
  0: "☀️", // clear sky
  1: "🌤️", // mainly clear
  2: "⛅", // partly cloudy
  3: "☁️", // overcast
  45: "🌫️", // fog
  48: "🌫️", // depositing rime fog
  51: "🌦️", // light drizzle
  53: "🌦️", // moderate drizzle
  55: "🌧️", // dense drizzle
  56: "🌨️", // light freezing drizzle
  57: "🌨️", // dense freezing drizzle
  61: "🌧️", // slight rain
  63: "🌧️", // moderate rain
  65: "🌧️", // heavy rain
  66: "🌨️", // light freezing rain
  67: "🌨️", // heavy freezing rain
  71: "🌨️", // slight snow
  73: "🌨️", // moderate snow
  75: "❄️", // heavy snow
  77: "🌨️", // snow grains
  80: "🌦️", // slight rain showers
  81: "🌧️", // moderate rain showers
  82: "⛈️", // violent rain showers
  85: "🌨️", // slight snow showers
  86: "❄️", // heavy snow showers
  95: "⛈️", // thunderstorm
  96: "⛈️", // thunderstorm with slight hail
  99: "⛈️", // thunderstorm with heavy hail
};

let lastWeatherData = null;
let lastFetchTime = 0;
let isFetching = false;

async function updateWeather(retryCount = 0) {
  if (isFetching) return;
  // reuse cache
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
