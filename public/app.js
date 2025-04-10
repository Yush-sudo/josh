const socket = new WebSocket("ws://" + window.location.host);

socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "salesUpdate") {
        document.getElementById("daily-sales").innerText = message.data.daily || 'N/A';
        document.getElementById("weekly-sales").innerText = message.data.weekly || 'N/A';
        document.getElementById("monthly-sales").innerText = message.data.monthly || 'N/A';
    }

    if (message.type === "intrusionAlert") {
        if (message.data.alert) {
            document.getElementById("alert-notification").style.display = "block";
            playAlarm();
        } else {
            document.getElementById("alert-notification").style.display = "none";
        }
    }
};

document.getElementById("disable-alarm").addEventListener("click", () => {
    fetch("/api/disable-alarm", {
        method: "POST",
        headers: {
            "Authorization": "Bearer supersecure123"
        }
    })
    .then(response => response.json())
    .then(() => document.getElementById("alert-notification").style.display = "none")
    .catch(error => console.error("Error disabling alarm:", error));
});

function playAlarm() {
    const audio = new Audio('alarm.mp3');
    audio.play();
    if (navigator.vibrate) {
        navigator.vibrate([500, 300, 500]);
    }
}
