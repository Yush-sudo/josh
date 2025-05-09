const socket = new WebSocket("wss://" + window.location.host);

// Track sales data
let salesData = {
    daily: 0,
    weekly: 0,
    monthly: 0
};

// Track device status
let deviceStatus = "online";
let selectedDeviceId = null;

// Initialize charts
let salesChart;

socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "salesUpdate") {
        // Update sales values in the UI
        if (message.data.daily !== undefined) {
            document.getElementById("daily-sales").innerText = message.data.daily;
            salesData.daily = message.data.daily;
        }
        if (message.data.weekly !== undefined) {
            document.getElementById("weekly-sales").innerText = message.data.weekly;
            salesData.weekly = message.data.weekly;
        }
        if (message.data.monthly !== undefined) {
            document.getElementById("monthly-sales").innerText = message.data.monthly;
            salesData.monthly = message.data.monthly;
        }
        
        // Update chart if it exists
        if (salesChart) {
            updateSalesChart();
        }
    }

    if (message.type === "intrusionAlert") {
        if (message.data.alert) {
            document.getElementById("alert-notification").style.display = "block";
            playAlarm();
            
            // Change status to alert if device matches
            if (message.data.device_id === selectedDeviceId || !selectedDeviceId) {
                deviceStatus = "alert";
                updateDeviceStatus();
            }
        } else {
            document.getElementById("alert-notification").style.display = "none";
            
            // Reset status to online
            if (message.data.device_id === selectedDeviceId || !selectedDeviceId) {
                deviceStatus = "online";
                updateDeviceStatus();
            }
        }
    }
    
    // Handle device status updates
    if (message.type === "deviceStatus") {
        if (message.data.device_id === selectedDeviceId || !selectedDeviceId) {
            deviceStatus = message.data.status;
            updateDeviceStatus();
        }
    }
};

// Update device status indicator
function updateDeviceStatus() {
    const statusElement = document.getElementById("device-status");
    if (statusElement) {
        // Remove previous status classes
        statusElement.classList.remove("status-online", "status-offline", "status-alert");
        
        // Add current status class
        statusElement.classList.add(`status-${deviceStatus}`);
        
        // Update text
        statusElement.innerText = deviceStatus.toUpperCase();
    }
}

// Initialize chart if the element exists
function initializeChart() {
    const chartElement = document.getElementById("sales-chart");
    if (chartElement) {
        const ctx = chartElement.getContext("2d");
        salesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Daily', 'Weekly', 'Monthly'],
                datasets: [{
                    label: 'Sales',
                    data: [salesData.daily, salesData.weekly, salesData.monthly],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(153, 102, 255, 0.5)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Update chart with current sales data
function updateSalesChart() {
    if (salesChart) {
        salesChart.data.datasets[0].data = [salesData.daily, salesData.weekly, salesData.monthly];
        salesChart.update();
    }
}

// Function to disable alarm
function disableAlarm() {
    fetch("/api/disable-alarm", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer supersecure123"
        },
        body: JSON.stringify({
            device_id: selectedDeviceId || "default"
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById("alert-notification").style.display = "none";
            
            // Update status
            deviceStatus = "online";
            updateDeviceStatus();
        }
    })
    .catch(error => console.error("Error disabling alarm:", error));
}

// Function to toggle coin rejection
function toggleCoinRejection(enable) {
    if (!selectedDeviceId) return;
    
    fetch("/api/device/settings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer supersecure123"
        },
        body: JSON.stringify({
            device_id: selectedDeviceId,
            coin_rejection: enable
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const coinRejectionBtn = document.getElementById("coin-rejection-status");
            if (coinRejectionBtn) {
                coinRejectionBtn.innerText = enable ? "ON" : "OFF";
                coinRejectionBtn.className = enable ? "status-alert" : "status-online";
            }
        }
    })
    .catch(error => console.error("Error toggling coin rejection:", error));
}

// Function to toggle sensors
function toggleSensors(enable) {
    if (!selectedDeviceId) return;
    
    fetch("/api/device/settings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer supersecure123"
        },
        body: JSON.stringify({
            device_id: selectedDeviceId,
            sensors_enabled: enable
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const sensorsBtn = document.getElementById("sensors-status");
            if (sensorsBtn) {
                sensorsBtn.innerText = enable ? "ON" : "OFF";
                sensorsBtn.className = enable ? "status-online" : "status-offline";
            }
        }
    })
    .catch(error => console.error("Error toggling sensors:", error));
}

// Handle alarm disable button click
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chart if available
    if (typeof Chart !== 'undefined') {
        initializeChart();
    }
    
    // Add event listener to disable alarm button
    const disableAlarmBtn = document.getElementById("disable-alarm");
    if (disableAlarmBtn) {
        disableAlarmBtn.addEventListener("click", disableAlarm);
    }
    
    // Add event listeners to coin rejection toggle
    const coinRejectionOn = document.getElementById("coin-rejection-on");
    const coinRejectionOff = document.getElementById("coin-rejection-off");
    
    if (coinRejectionOn) {
        coinRejectionOn.addEventListener("click", () => toggleCoinRejection(true));
    }
    
    if (coinRejectionOff) {
        coinRejectionOff.addEventListener("click", () => toggleCoinRejection(false));
    }
    
    // Add event listeners to sensors toggle
    const sensorsOn = document.getElementById("sensors-on");
    const sensorsOff = document.getElementById("sensors-off");
    
    if (sensorsOn) {
        sensorsOn.addEventListener("click", () => toggleSensors(true));
    }
    
    if (sensorsOff) {
        sensorsOff.addEventListener("click", () => toggleSensors(false));
    }
    
    // Get device list if available
    const deviceList = document.getElementById("device-list");
    if (deviceList) {
        fetch("/api/devices")
            .then(response => response.json())
            .then(data => {
                if (data.devices && data.devices.length > 0) {
                    data.devices.forEach(device => {
                        const option = document.createElement("option");
                        option.value = device.device_id;
                        option.text = device.name || device.device_id;
                        deviceList.appendChild(option);
                    });
                    
                    // Select first device
                    selectedDeviceId = data.devices[0].device_id;
                    deviceStatus = data.devices[0].status;
                    updateDeviceStatus();
                    
                    // Fetch initial sales data
                    fetchSalesData(selectedDeviceId);
                }
            })
            .catch(error => console.error("Error fetching devices:", error));
    }
});

// Function to play alarm sound
function playAlarm() {
    const audio = new Audio('alarm.mp3');
    audio.play();
    if (navigator.vibrate) {
        navigator.vibrate([500, 300, 500]);
    }
}

// Function to fetch sales data
function fetchSalesData(deviceId) {
    if (!deviceId) return;
    
    // Fetch daily sales
    fetch(`/api/sales/stats?device_id=${deviceId}&period=daily`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                salesData.daily = data.total;
                document.getElementById("daily-sales").innerText = data.total;
                
                // Update chart
                if (salesChart) {
                    updateSalesChart();
                }
            }
        })
        .catch(error => console.error("Error fetching daily sales:", error));
    
    // Fetch weekly sales
    fetch(`/api/sales/stats?device_id=${deviceId}&period=weekly`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                salesData.weekly = data.total;
                document.getElementById("weekly-sales").innerText = data.total;
                
                // Update chart
                if (salesChart) {
                    updateSalesChart();
                }
            }
        })
        .catch(error => console.error("Error fetching weekly sales:", error));
    
    // Fetch monthly sales
    fetch(`/api/sales/stats?device_id=${deviceId}&period=monthly`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                salesData.monthly = data.total;
                document.getElementById("monthly-sales").innerText = data.total;
                
                // Update chart
                if (salesChart) {
                    updateSalesChart();
                }
            }
        })
        .catch(error => console.error("Error fetching monthly sales:", error));
}