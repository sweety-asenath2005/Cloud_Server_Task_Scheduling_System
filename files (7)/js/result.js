/* ============================================
   Cloud Server Task Scheduling System
   js/result.js

   Handles everything on result.html:
   - Reading simulation data from localStorage
   - Displaying the selected algorithm and summary
   - Building the Cloud Server Execution Timeline (Gantt chart)
   - Populating the cloud task execution results table
   - Calculating and displaying averages / cloud performance metrics
   - Updating the server execution status banner
   - Handling Back / New Simulation buttons
   ============================================ */

var algorithmNames = {
  fcfs: "FCFS",
  sjf: "SJF (Non-Preemptive)",
  priority: "Priority Scheduling",
  rr: "Round Robin"
};

// ---------- DOM References ----------
var noDataBox = document.getElementById("noDataBox");
var resultsContent = document.getElementById("resultsContent");

var summaryAlgorithm = document.getElementById("summaryAlgorithm");
var summaryProcessCount = document.getElementById("summaryProcessCount");
var summaryTimeQuantum = document.getElementById("summaryTimeQuantum");

var ganttBlocks = document.getElementById("ganttBlocks");
var ganttTimes = document.getElementById("ganttTimes");

var resultsTableBody = document.getElementById("resultsTableBody");

var avgWaitingTimeEl = document.getElementById("avgWaitingTime");
var avgTurnaroundTimeEl = document.getElementById("avgTurnaroundTime");
var selectedSchedulerEl = document.getElementById("selectedScheduler");
var totalExecutionTimeEl = document.getElementById("totalExecutionTime");
var cpuUtilizationEl = document.getElementById("cpuUtilization");
var throughputEl = document.getElementById("throughput");

var barWaiting = document.getElementById("barWaiting");
var barWaitingValue = document.getElementById("barWaitingValue");
var barTurnaround = document.getElementById("barTurnaround");
var barTurnaroundValue = document.getElementById("barTurnaroundValue");

var newSimulationBtn = document.getElementById("newSimulationBtn");

// Cloud metrics cards
var metricTasksReceived = document.getElementById("metricTasksReceived");
var metricTasksCompleted = document.getElementById("metricTasksCompleted");

// Server execution status banner
var esStatusPill = document.getElementById("esStatusPill");
var esScheduler = document.getElementById("esScheduler");
var esTasksProcessed = document.getElementById("esTasksProcessed");
var esTimeline = document.getElementById("esTimeline");

// ---------- Load simulation data ----------
function loadSimulationData() {
  var rawData = localStorage.getItem("cstsSimulationData");

  if (!rawData) {
    noDataBox.style.display = "block";
    resultsContent.style.display = "none";
    return;
  }

  var data;
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    noDataBox.style.display = "block";
    resultsContent.style.display = "none";
    return;
  }

  if (!data || !data.processResults || data.processResults.length === 0) {
    noDataBox.style.display = "block";
    resultsContent.style.display = "none";
    return;
  }

  noDataBox.style.display = "none";
  resultsContent.style.display = "block";

  renderSummary(data);
  renderGanttChart(data.gantt);
  renderResultsTable(data.processResults);
  renderPerformanceSummary(data.processResults, data.gantt);
  renderCloudMetrics(data);
  renderExecutionStatus(data);
}

// ---------- Summary bar ----------
function renderSummary(data) {
  summaryAlgorithm.textContent = algorithmNames[data.algorithm] || data.algorithm;
  summaryProcessCount.textContent = data.processResults.length;
  summaryTimeQuantum.textContent = data.algorithm === "rr" ? data.timeQuantum : "N/A";
}

// ---------- Gantt Chart (Cloud Server Execution Timeline) ----------
function renderGanttChart(gantt) {
  ganttBlocks.innerHTML = "";
  ganttTimes.innerHTML = "";

  if (!gantt || gantt.length === 0) return;

  gantt.forEach(function (block) {
    var blockDiv = document.createElement("div");
    blockDiv.className = block.type === "idle" ? "gantt-block idle" : "gantt-block";
    blockDiv.textContent = block.type === "idle" ? "IDLE" : block.id;
    ganttBlocks.appendChild(blockDiv);

    var timeMark = document.createElement("div");
    timeMark.className = "gantt-time-mark";
    timeMark.innerHTML = "<span>" + block.start + "</span>";
    ganttTimes.appendChild(timeMark);
  });

  // Final time mark for the end of the last block
  var lastBlock = gantt[gantt.length - 1];
  var finalMark = document.createElement("div");
  finalMark.className = "gantt-time-mark";
  finalMark.style.minWidth = "0";
  finalMark.innerHTML = "<span>" + lastBlock.end + "</span>";
  ganttTimes.appendChild(finalMark);
}

// ---------- Results Table (Cloud Task Execution Results) ----------
function renderResultsTable(processResults) {
  resultsTableBody.innerHTML = "";

  processResults.forEach(function (p) {
    var row = document.createElement("tr");
    row.innerHTML =
      "<td>" + p.id + "</td>" +
      "<td>" + p.arrivalTime + "</td>" +
      "<td>" + p.burstTime + "</td>" +
      "<td>" + p.priority + "</td>" +
      "<td>" + p.completionTime + "</td>" +
      "<td>" + p.turnaroundTime + "</td>" +
      "<td>" + p.waitingTime + "</td>";
    resultsTableBody.appendChild(row);
  });
}

// ---------- Performance Summary ----------
function renderPerformanceSummary(processResults, gantt) {
  var totalWaiting = 0;
  var totalTurnaround = 0;

  processResults.forEach(function (p) {
    totalWaiting += p.waitingTime;
    totalTurnaround += p.turnaroundTime;
  });

  var count = processResults.length;
  var avgWaiting = totalWaiting / count;
  var avgTurnaround = totalTurnaround / count;

  avgWaitingTimeEl.textContent = avgWaiting.toFixed(2) + " ms";
  avgTurnaroundTimeEl.textContent = avgTurnaround.toFixed(2) + " ms";

// Total execution time = end of the last Gantt block
  var totalExecutionTime = gantt && gantt.length > 0 ? gantt[gantt.length - 1].end : 0;
  totalExecutionTimeEl.textContent = totalExecutionTime + " ms";

  // CPU Utilization = (total busy time / total execution time) * 100
  var busyTime = 0;
  if (gantt) {
    gantt.forEach(function (block) {
      if (block.type === "process") {
        busyTime += (block.end - block.start);
      }
    });
  }
  var cpuUtil = totalExecutionTime > 0 ? (busyTime / totalExecutionTime) * 100 : 0;
  cpuUtilizationEl.textContent = cpuUtil.toFixed(1) + " %";

  // Throughput = number of completed tasks / total execution time
  var throughput = totalExecutionTime > 0 ? (count / totalExecutionTime).toFixed(3) : "0.000";
  throughputEl.textContent = throughput + " tasks/ms";

  // Performance comparison bars (scaled relative to the larger value)
  var maxValue = Math.max(avgWaiting, avgTurnaround, 1);
  var waitingPercent = (avgWaiting / maxValue) * 100;
  var turnaroundPercent = (avgTurnaround / maxValue) * 100;

  barWaiting.style.width = waitingPercent + "%";
  barTurnaround.style.width = turnaroundPercent + "%";

  barWaitingValue.textContent = avgWaiting.toFixed(2);
  barTurnaroundValue.textContent = avgTurnaround.toFixed(2);
}

// ---------- Cloud Metrics ----------
function renderCloudMetrics(data) {
  var total = data.processResults.length;
  metricTasksReceived.textContent = total;
  metricTasksCompleted.textContent = total;

  // Selected scheduler card
  selectedSchedulerEl.textContent = algorithmNames[data.algorithm] || data.algorithm;
}

// ---------- Server Execution Status ----------
function renderExecutionStatus(data) {
  var algoName = algorithmNames[data.algorithm] || data.algorithm;
  var total = data.processResults.length;

  esStatusPill.textContent = "Processing Complete ✓";
  esScheduler.textContent = algoName;

  // Build timeline from Gantt (excluding idle blocks)
  var timeline = [];
  if (data.gantt) {
    data.gantt.forEach(function (block) {
      if (block.type === "process") {
        timeline.push(block.id);
      }
    });
  }
  esTasksProcessed.textContent = timeline.length + " / " + total;

  if (timeline.length > 0) {
    esTimeline.textContent = timeline.join(" → ");
  } else {
    esTimeline.textContent = "No tasks scheduled";
  }
}

// ---------- New Simulation ----------
function handleNewSimulation() {
  localStorage.removeItem("cstsSimulationData");
  window.location.href = "input.html";
}

newSimulationBtn.addEventListener("click", handleNewSimulation);

// ---------- Initial Load ----------
loadSimulationData();
