/* ============================================
   Cloud Server Task Scheduling System
   js/scheduling.js

   This file contains ONLY the scheduling logic.
   Each function receives an array of process objects:
     { id, arrivalTime, burstTime, priority, originalIndex }
   and returns a result object:
     {
       processResults: [ { id, arrivalTime, burstTime, priority,
                            completionTime, turnaroundTime, waitingTime } ],
       gantt: [ { type: "process"|"idle", id, start, end } ]
     }
   ============================================ */

/**
 * Helper: build the final process result list once every process
 * has a completionTime assigned.
 */
function buildProcessResults(processes, completionTimes) {
  return processes.map(function (p) {
    var completionTime = completionTimes[p.id];
    var turnaroundTime = completionTime - p.arrivalTime;
    var waitingTime = turnaroundTime - p.burstTime;
    return {
      id: p.id,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      priority: p.priority,
      completionTime: completionTime,
      turnaroundTime: turnaroundTime,
      waitingTime: waitingTime
    };
  });
}

/* ============================================
   A. FIRST COME FIRST SERVE (FCFS)
   ============================================ */
function fcfs(processes) {
  // Sort by arrival time; if equal, keep original input order
  var sorted = processes.slice().sort(function (a, b) {
    if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
    return a.originalIndex - b.originalIndex;
  });

  var currentTime = 0;
  var gantt = [];
  var completionTimes = {};

  for (var i = 0; i < sorted.length; i++) {
    var process = sorted[i];

    // If CPU is idle before this process arrives, record idle time
    if (currentTime < process.arrivalTime) {
      gantt.push({ type: "idle", start: currentTime, end: process.arrivalTime });
      currentTime = process.arrivalTime;
    }

    var start = currentTime;
    var end = start + process.burstTime;

    gantt.push({ type: "process", id: process.id, start: start, end: end });

    completionTimes[process.id] = end;
    currentTime = end;
  }

  return {
    processResults: buildProcessResults(processes, completionTimes),
    gantt: gantt
  };
}

/* ============================================
   B. NON-PREEMPTIVE SHORTEST JOB FIRST (SJF)
   ============================================ */
function sjf(processes) {
  var remaining = processes.slice();
  var currentTime = 0;
  var gantt = [];
  var completionTimes = {};

  while (remaining.length > 0) {
    // Find processes that have already arrived
    var available = remaining.filter(function (p) {
      return p.arrivalTime <= currentTime;
    });

    if (available.length === 0) {
      // CPU idle until the next process arrives
      var nextArrival = Math.min.apply(null, remaining.map(function (p) { return p.arrivalTime; }));
      gantt.push({ type: "idle", start: currentTime, end: nextArrival });
      currentTime = nextArrival;
      continue;
    }

    // Choose the process with the shortest burst time.
    // Tie-breakers: earlier arrival time, then original order.
    available.sort(function (a, b) {
      if (a.burstTime !== b.burstTime) return a.burstTime - b.burstTime;
      if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
      return a.originalIndex - b.originalIndex;
    });

    var selected = available[0];

    // Remove selected process from the remaining list
    remaining = remaining.filter(function (p) { return p.id !== selected.id; });

    var start = currentTime;
    var end = start + selected.burstTime;

    gantt.push({ type: "process", id: selected.id, start: start, end: end });

    completionTimes[selected.id] = end;
    currentTime = end;
  }

  return {
    processResults: buildProcessResults(processes, completionTimes),
    gantt: gantt
  };
}

/* ============================================
   C. NON-PREEMPTIVE PRIORITY SCHEDULING
   (Smaller priority number = higher priority)
   ============================================ */
function priorityScheduling(processes) {
  var remaining = processes.slice();
  var currentTime = 0;
  var gantt = [];
  var completionTimes = {};

  while (remaining.length > 0) {
    var available = remaining.filter(function (p) {
      return p.arrivalTime <= currentTime;
    });

    if (available.length === 0) {
      var nextArrival = Math.min.apply(null, remaining.map(function (p) { return p.arrivalTime; }));
      gantt.push({ type: "idle", start: currentTime, end: nextArrival });
      currentTime = nextArrival;
      continue;
    }

    // Choose the process with the highest priority (lowest number).
    // Tie-breakers: earlier arrival time, then original order.
    available.sort(function (a, b) {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
      return a.originalIndex - b.originalIndex;
    });

    var selected = available[0];

    remaining = remaining.filter(function (p) { return p.id !== selected.id; });

    var start = currentTime;
    var end = start + selected.burstTime;

    gantt.push({ type: "process", id: selected.id, start: start, end: end });

    completionTimes[selected.id] = end;
    currentTime = end;
  }

  return {
    processResults: buildProcessResults(processes, completionTimes),
    gantt: gantt
  };
}

/* ============================================
   D. ROUND ROBIN SCHEDULING
   ============================================ */
function roundRobin(processes, timeQuantum) {
  var n = processes.length;

  // Sort a copy by arrival time (tie: original order) - this defines
  // the order in which processes become available to join the queue.
  var byArrival = processes.slice().sort(function (a, b) {
    if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
    return a.originalIndex - b.originalIndex;
  });

  var remainingBurst = {};
  processes.forEach(function (p) { remainingBurst[p.id] = p.burstTime; });

  var arrivedFlag = {};
  processes.forEach(function (p) { arrivedFlag[p.id] = false; });

  var completionTimes = {};
  var gantt = [];
  var queue = [];
  var completedCount = 0;
  var currentTime = byArrival[0].arrivalTime;

  // If the first process does not arrive at time 0, CPU is idle first
  if (currentTime > 0) {
    gantt.push({ type: "idle", start: 0, end: currentTime });
  }

  // Adds every process whose arrivalTime <= currentTime and who
  // has not yet joined the queue, in arrival/original order.
  function admitArrivals() {
    for (var i = 0; i < byArrival.length; i++) {
      var p = byArrival[i];
      if (!arrivedFlag[p.id] && p.arrivalTime <= currentTime) {
        queue.push(p);
        arrivedFlag[p.id] = true;
      }
    }
  }

  admitArrivals();

  while (completedCount < n) {
    if (queue.length === 0) {
      // No process ready - jump time forward to the next arrival
      var notArrived = byArrival.filter(function (p) { return !arrivedFlag[p.id]; });
      var nextArrival = Math.min.apply(null, notArrived.map(function (p) { return p.arrivalTime; }));

      if (currentTime < nextArrival) {
        gantt.push({ type: "idle", start: currentTime, end: nextArrival });
      }
      currentTime = nextArrival;
      admitArrivals();
      continue;
    }

    var current = queue.shift();
    var execTime = Math.min(timeQuantum, remainingBurst[current.id]);
    var start = currentTime;
    var end = start + execTime;

    gantt.push({ type: "process", id: current.id, start: start, end: end });

    currentTime = end;
    remainingBurst[current.id] -= execTime;

    // Admit any processes that arrived during this execution slice
    // BEFORE re-inserting the current process (standard convention)
    admitArrivals();

    if (remainingBurst[current.id] > 0) {
      // Still has remaining burst time - goes to the back of the queue
      queue.push(current);
    } else {
      completionTimes[current.id] = currentTime;
      completedCount++;
    }
  }

  return {
    processResults: buildProcessResults(processes, completionTimes),
    gantt: gantt
  };
}

/* ============================================
   MASTER RUNNER
   Runs the correct algorithm based on the
   algorithm key and returns the standard result.
   ============================================ */
function runScheduling(algorithmKey, processes, timeQuantum) {
  // Attach an originalIndex to preserve "first entered" order for tie-breaks
  var indexedProcesses = processes.map(function (p, index) {
    return {
      id: p.id,
      arrivalTime: Number(p.arrivalTime),
      burstTime: Number(p.burstTime),
      priority: Number(p.priority),
      originalIndex: index
    };
  });

  switch (algorithmKey) {
    case "fcfs":
      return fcfs(indexedProcesses);
    case "sjf":
      return sjf(indexedProcesses);
    case "priority":
      return priorityScheduling(indexedProcesses);
    case "rr":
      return roundRobin(indexedProcesses, Number(timeQuantum));
    default:
      throw new Error("Invalid algorithm selection.");
  }
}
