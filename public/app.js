// --- Final Updated Web App JavaScript Code ---

const ESP32_IP = "192.168.1.10"; // Replace with actual ESP32 IP

// Fetch Sales Data
async function fetchSalesData() {
  try {
    const response = await fetch(`http://${ESP32_IP}/api/get-sales`);
    const data = await response.json();

    document.getElementById('daily-sales').textContent = `₱${data.daily}`;
    document.getElementById('weekly-sales').textContent = `₱${data.weekly}`;
    document.getElementById('monthly-sales').textContent = `₱${data.monthly}`;
  } catch (error) {
    console.error("Error fetching sales data:", error);
  }
}

setInterval(fetchSalesData, 10000);
fetchSalesData();

// Fetch Sensor Status
async function fetchSensorStatus() {
  try {
    const response = await fetch(`http://${ESP32_IP}/api/get-sensor-status`);
    const data = await response.json();
    const statusEl = document.getElementById('sensors-status');
    if (data.sensors === "enabled") {
      statusEl.textContent = "ON";
      statusEl.className = "status-online";
    } else {
      statusEl.textContent = "OFF";
      statusEl.className = "status-offline";
    }
  } catch (error) {
    console.error("Error fetching sensor status:", error);
  }
}

setInterval(fetchSensorStatus, 5000);
fetchSensorStatus();

// Toggle Sensors (both buttons use the same endpoint)
document.getElementById("sensors-on").addEventListener("click", async () => {
  await toggleSensors();
});

document.getElementById("sensors-off").addEventListener("click", async () => {
  await toggleSensors();
});

async function toggleSensors() {
  try {
    const response = await fetch(`http://${ESP32_IP}/api/toggle-sensors`, {
      method: 'POST'
    });
    const data = await response.json();
    fetchSensorStatus();
  } catch (error) {
    console.error("Error toggling sensors:", error);
  }
}

// Coin Rejection toggles (UI only, no hardware integration shown)
document.getElementById("coin-rejection-on").addEventListener("click", () => {
  document.getElementById("coin-rejection-status").textContent = "ON";
  document.getElementById("coin-rejection-status").className = "status-online";
});

document.getElementById("coin-rejection-off").addEventListener("click", () => {
  document.getElementById("coin-rejection-status").textContent = "OFF";
  document.getElementById("coin-rejection-status").className = "status-offline";
});

// Intrusion Alert Check from backend
async function checkIntrusionAlerts() {
  try {
    const response = await fetch('https://josh-780a.onrender.com/api/recent-alerts');
    const alerts = await response.json();

    if (alerts.length > 0) {
      alerts.forEach(alert => {
        alertUser(alert.triggered_by, alert.timestamp);
      });
    }
  } catch (error) {
    console.error("Error checking alerts:", error);
  }
}

function alertUser(sensor, timestamp) {
  alert(`Intrusion detected by: ${sensor} at ${new Date(timestamp).toLocaleString()}`);
}

setInterval(checkIntrusionAlerts, 5000);
