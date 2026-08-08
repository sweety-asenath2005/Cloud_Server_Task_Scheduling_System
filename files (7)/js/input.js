/* ============================================
   Cloud Server Task Scheduling System
   js/input.js

   Handles everything on input.html:
   - Reading and validating cloud task input
   - Adding / deleting / clearing cloud tasks
   - Loading sample tasks
   - Rendering the Cloud Task Queue (visual cards)
   - Updating the Cloud Server Status card
   - Algorithm (Scheduling Strategy) selection UI
   - Running the simulation and navigating to result.html
   ============================================ */

// In-memory list of cloud tasks for the current simulation
// (kept as "processList" internally because the scheduling engine
//  uses CPU scheduling algorithms that operate on process objects)
var processList = [];

// Descriptions shown for each scheduling strategy (cloud-task context)
var algorithmDescriptions = {
  fcfs: "Schedules cloud tasks in the order they arrive.",
  sjf: "Selects the available cloud task requiring the shortest CPU execution time.",
  priority: "Executes the highest-priority available cloud task first.",
  rr: "Shares CPU execution time among cloud tasks using a fixed time quantum."
};

// Sample data used for quick demonstrations
var sampleTasks = [
  { id: "T1", arrivalTime: 0, burstTime: 5, priority: 2 },
  { id: "T2", arrivalTime: 1, burstTime: 3, priority: 1 },
  { id: "T3", arrivalTime: 2, burstTime: 8, priority: 3 },
  { id: "T4", arrivalTime: 3, burstTime: 2, priority: 2 }
];

// Display names for each scheduling strategy (used in the server status card)
var algorithmNames = {
  fcfs: "FCFS",
  sjf: "SJF",
  priority: "Priority",
  rr: "Round Robin"
};

// ---------- DOM References ----------
var processForm = document.getElementById("processForm");
var processIdInput = document.getElementById("processId");
var arrivalTimeInput = document.getElementById("arrivalTime");
var burstTimeInput = document.getElementById("burstTime");
var priorityInput = document.getElementById("priority");
var formError = document.getElementById("formError");

var processTableBody = document.getElementById("processTableBody");
var emptyStateMessage = document.getElementById("emptyStateMessage");

var taskQueueContainer = document.getElementById("taskQueue");
var taskQueueEmpty = document.getElementById("taskQueueEmpty");
var queueCountEl = document.getElementById("queueCount");

var serverStatusTitle = document.getElementById("serverStatusTitle");
var serverStatusSub = document.getElementById("serverStatusSub");
var ssTasksWaiting = document.getElementById("ssTasksWaiting");
var ssEngine = document.getElementById("ssEngine");

var toast = document.getElementById("toast");
var toastTimer = null;

var sampleDataBtn = document.getElementById("sampleDataBtn");
var clearAllBtn = document.getElementById("clearAllBtn");

var algoOptions = document.querySelectorAll(".algo-option");
var algoDescription = document.getElementById("algoDescription");
var timeQuantumGroup = document.getElementById("timeQuantumGroup");
var timeQuantumInput = document.getElementById("timeQuantum");

var runSimulationBtn = document.getElementById("runSimulationBtn");
var simulationError = document.getElementById("simulationError");

// ---------- Helper: show an error message ----------
function showError(element, message) {
  element.textContent = message;
  element.classList.add("visible");
}

function clearError(element) {
  element.textContent = "";
  element.classList.remove("visible");
}

// ---------- Render the cloud task table ----------
function renderProcessTable() {
  processTableBody.innerHTML = "";

  if (processList.length === 0) {
    emptyStateMessage.style.display = "block";
    return;
  }

  emptyStateMessage.style.display = "none";

  processList.forEach(function (task, index) {
    var row = document.createElement("tr");

    row.innerHTML =
      "<td>" + task.id + "</td>" +
      "<td>" + task.arrivalTime + "</td>" +
      "<td>" + task.burstTime + "</td>" +
      "<td>" + task.priority + "</td>" +
      "<td><button type='button' class='btn btn-danger' data-index='" + index + "'>Delete</button></td>";

    processTableBody.appendChild(row);
  });

  // Attach delete handlers
  var deleteButtons = processTableBody.querySelectorAll("button[data-index]");
  deleteButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var index = Number(btn.getAttribute("data-index"));
      var removed = processList.splice(index, 1)[0];
      renderProcessTable();
      renderTaskQueue();
      updateServerStatus();
      showToast("Cloud task " + removed.id + " removed from the queue.");
    });
  });
}

// ---------- Render the Cloud Task Queue (visual cards) ----------
function renderTaskQueue() {
  taskQueueContainer.innerHTML = "";

  // Update the live count badge next to the panel heading
  if (queueCountEl) {
    queueCountEl.textContent = processList.length;
  }

  if (processList.length === 0) {
    taskQueueEmpty.style.display = "block";
    return;
  }

  taskQueueEmpty.style.display = "none";

processList.forEach(function (task, index) {
    var card = document.createElement("div");
    card.className = "task-queue-card";

    var header = document.createElement("div");
    header.className = "tq-header";
    header.innerHTML = '<span class="tq-icon">☁️</span> <span>' + task.id + "</span>";

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "tq-remove";
    removeBtn.setAttribute("aria-label", "Remove " + task.id + " from queue");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", function () {
      processList.splice(index, 1);
      renderProcessTable();
      renderTaskQueue();
      updateServerStatus();
      showToast("Cloud task " + task.id + " removed from the queue.");
    });
    header.appendChild(removeBtn);

    card.appendChild(header);

    var meta = document.createElement("div");
    meta.className = "tq-meta";
    meta.innerHTML =
      "<span><strong>CPU:</strong> " + task.burstTime + "</span>" +
      "<span><strong>Arrival:</strong> " + task.arrivalTime + "</span>" +
      "<span><strong>Priority:</strong> " + task.priority + "</span>";
    card.appendChild(meta);

    taskQueueContainer.appendChild(card);
  });
}

// ---------- Update the Cloud Server Status card ----------
function updateServerStatus() {
  var count = processList.length;

  // Show the currently selected scheduling strategy
  var selectedRadio = document.querySelector("input[name='algorithm']:checked");
  var selectedAlgo = selectedRadio ? selectedRadio.value : "fcfs";
  ssEngine.textContent = algorithmNames[selectedAlgo] || "Ready";

  if (count === 0) {
    serverStatusTitle.textContent = "Cloud Server Ready";
    serverStatusSub.textContent = "Waiting for incoming cloud tasks...";
    ssTasksWaiting.textContent = "0";
    return;
  }

  serverStatusTitle.textContent = "Cloud Server Ready";
  serverStatusSub.textContent = "Incoming cloud tasks queued for scheduling.";
  ssTasksWaiting.textContent = count;
}

// ---------- Helper: show a success/feedback toast ----------
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  // Clear any previous timer
  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  // Auto-hide after 2.5 seconds
  toastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 2500);
}

// ---------- Validate and add a cloud task ----------
function handleAddProcess(event) {
  event.preventDefault();
  clearError(formError);

  var id = processIdInput.value.trim();
  var arrivalRaw = arrivalTimeInput.value.trim();
  var burstRaw = burstTimeInput.value.trim();
  var priorityRaw = priorityInput.value.trim();

  // Task ID validation
  if (id === "") {
    showError(formError, "Task ID cannot be empty.");
    return;
  }

  var idExists = processList.some(function (p) { return p.id.toLowerCase() === id.toLowerCase(); });
  if (idExists) {
    showError(formError, "Task ID must be unique. '" + id + "' already exists.");
    return;
  }

  // Arrival Time validation
  if (arrivalRaw === "" || isNaN(arrivalRaw)) {
    showError(formError, "Arrival Time must be a number.");
    return;
  }
  var arrivalTime = Number(arrivalRaw);
  if (!Number.isInteger(arrivalTime) || arrivalTime < 0) {
    showError(formError, "Arrival Time must be a whole number that is 0 or greater.");
    return;
  }

  // CPU Execution Time validation
  if (burstRaw === "" || isNaN(burstRaw)) {
    showError(formError, "CPU Execution Time must be a number.");
    return;
  }
  var burstTime = Number(burstRaw);
  if (!Number.isInteger(burstTime) || burstTime <= 0) {
    showError(formError, "CPU Execution Time must be a whole number greater than 0.");
    return;
  }

  // Priority validation
  if (priorityRaw === "" || isNaN(priorityRaw)) {
    showError(formError, "Priority must be a number.");
    return;
  }
  var priority = Number(priorityRaw);
  if (!Number.isInteger(priority) || priority <= 0) {
    showError(formError, "Priority must be a whole number greater than 0.");
    return;
  }

  // All valid - add the cloud task
  processList.push({ id: id, arrivalTime: arrivalTime, burstTime: burstTime, priority: priority });
  renderProcessTable();
  renderTaskQueue();
  updateServerStatus();
  showToast("Cloud task " + id + " added to the queue.");

  // Reset the form for the next entry
  processForm.reset();
  processIdInput.focus();
}

// ---------- Load sample tasks ----------
function handleLoadSampleData() {
  processList = sampleTasks.map(function (p) {
    return { id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime, priority: p.priority };
  });

  // Auto-fill the Time Quantum (used for Round Robin demonstration)
  timeQuantumInput.value = "2";

  renderProcessTable();
  renderTaskQueue();
  updateServerStatus();
  clearError(formError);
  clearError(simulationError);
  showToast("Sample cloud tasks T1 - T4 loaded.");
}

// ---------- Clear all tasks ----------
function handleClearAll() {
  if (processList.length === 0) return;

  var confirmClear = confirm("Are you sure you want to clear all cloud tasks?");
  if (confirmClear) {
    processList = [];
    renderProcessTable();
    renderTaskQueue();
    updateServerStatus();
    clearError(simulationError);
    showToast("All cloud tasks cleared.");
  }
}

// ---------- Algorithm (Scheduling Strategy) selection UI ----------
function handleAlgorithmChange() {
  var selectedRadio = document.querySelector("input[name='algorithm']:checked");
  var selectedAlgo = selectedRadio ? selectedRadio.value : "fcfs";

  // Update description text
  algoDescription.textContent = algorithmDescriptions[selectedAlgo];

  // Highlight selected card
  algoOptions.forEach(function (option) {
    if (option.getAttribute("data-algo") === selectedAlgo) {
      option.classList.add("selected");
    } else {
      option.classList.remove("selected");
    }
  });

  // Show/hide Time Quantum field
  if (selectedAlgo === "rr") {
    timeQuantumGroup.style.display = "block";
  } else {
    timeQuantumGroup.style.display = "none";
  }

  updateServerStatus();
}

// ---------- Run Simulation (Schedule Cloud Tasks) ----------
function handleRunSimulation() {
  clearError(simulationError);

  // At least one cloud task must exist
  if (processList.length === 0) {
    showError(simulationError, "Please add at least one cloud task before scheduling.");
    return;
  }

  var selectedRadio = document.querySelector("input[name='algorithm']:checked");
  var selectedAlgo = selectedRadio ? selectedRadio.value : "fcfs";
  var timeQuantum = null;

  // Validate Time Quantum if Round Robin is selected
  if (selectedAlgo === "rr") {
    var tqRaw = timeQuantumInput.value.trim();
    if (tqRaw === "" || isNaN(tqRaw)) {
      showError(simulationError, "Please enter a valid Time Quantum for Round Robin.");
      return;
    }
    timeQuantum = Number(tqRaw);
    if (!Number.isInteger(timeQuantum) || timeQuantum <= 0) {
      showError(simulationError, "Time Quantum must be a whole number greater than 0.");
      return;
    }
  }

  // Run the selected algorithm (functions come from js/scheduling.js)
  var simulationResult;
  try {
    simulationResult = runScheduling(selectedAlgo, processList, timeQuantum);
  } catch (err) {
    showError(simulationError, "Something went wrong while scheduling the cloud tasks. Please check your inputs.");
    return;
  }

  // Save everything needed by result.html into localStorage
  var dataToStore = {
    algorithm: selectedAlgo,
    timeQuantum: timeQuantum,
    inputProcesses: processList,
    processResults: simulationResult.processResults,
    gantt: simulationResult.gantt
  };

  localStorage.setItem("cstsSimulationData", JSON.stringify(dataToStore));

  // Navigate to the results page
  window.location.href = "result.html";
}

// ---------- Event Listeners ----------
processForm.addEventListener("submit", handleAddProcess);
sampleDataBtn.addEventListener("click", handleLoadSampleData);
clearAllBtn.addEventListener("click", handleClearAll);
runSimulationBtn.addEventListener("click", handleRunSimulation);

algoOptions.forEach(function (option) {
  option.addEventListener("click", function () {
    var radio = option.querySelector("input[type='radio']");
    radio.checked = true;
    handleAlgorithmChange();
  });
});

// ---------- Initial Setup ----------
renderProcessTable();
renderTaskQueue();
updateServerStatus();
handleAlgorithmChange();
