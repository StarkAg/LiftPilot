import React from "react";

const FLOORS = Array.from({ length: 15 }, (_, index) => index + 1);
const DEFAULT_SETTINGS = {
  upWeight: 3,
  downWeight: 1,
  stopPenalty: 8,
  maxStops: 2
};

function expandRequests(counts) {
  return FLOORS.flatMap((floor) => Array(counts[floor] || 0).fill(floor));
}

function groupCost(requests, stop, upWeight, downWeight) {
  return requests.reduce((cost, floor) => {
    if (floor > stop) {
      return cost + upWeight * (floor - stop);
    }

    return cost + downWeight * (stop - floor);
  }, 0);
}

function bestSingleStop(requests, upWeight, downWeight) {
  const sorted = [...requests].sort((a, b) => a - b);
  const q = upWeight / (upWeight + downWeight);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function chooseBestPlan(requests, upWeight, downWeight, stopPenalty, maxStops) {
  if (!requests.length) {
    return { stops: [], cost: 0 };
  }

  const sorted = [...requests].sort((a, b) => a - b);
  const initialStop = bestSingleStop(sorted, upWeight, downWeight);
  let bestPlan = {
    stops: [initialStop],
    cost: groupCost(sorted, initialStop, upWeight, downWeight) + stopPenalty
  };

  if (maxStops < 2) {
    return bestPlan;
  }

  for (let cut = 0; cut < sorted.length - 1; cut += 1) {
    const left = sorted.slice(0, cut + 1);
    const right = sorted.slice(cut + 1);
    const leftStop = bestSingleStop(left, upWeight, downWeight);
    const rightStop = bestSingleStop(right, upWeight, downWeight);
    const cost =
      groupCost(left, leftStop, upWeight, downWeight) +
      groupCost(right, rightStop, upWeight, downWeight) +
      stopPenalty * 2;

    if (cost < bestPlan.cost) {
      bestPlan = {
        stops: [leftStop, rightStop],
        cost
      };
    }
  }

  return bestPlan;
}

function buildCalculationDetails(requests, upWeight, downWeight, stopPenalty, maxStops) {
  if (!requests.length) {
    return null;
  }

  const sorted = [...requests].sort((a, b) => a - b);
  const percentile = upWeight / (upWeight + downWeight);
  const singleStop = bestSingleStop(sorted, upWeight, downWeight);
  const singleWalkCost = groupCost(sorted, singleStop, upWeight, downWeight);
  const oneStopPlan = {
    stop: singleStop,
    walkingCost: singleWalkCost,
    totalCost: singleWalkCost + stopPenalty
  };

  const splitPlans = [];

  if (maxStops >= 2) {
    for (let cut = 0; cut < sorted.length - 1; cut += 1) {
      const left = sorted.slice(0, cut + 1);
      const right = sorted.slice(cut + 1);
      const leftStop = bestSingleStop(left, upWeight, downWeight);
      const rightStop = bestSingleStop(right, upWeight, downWeight);
      const walkingCost =
        groupCost(left, leftStop, upWeight, downWeight) +
        groupCost(right, rightStop, upWeight, downWeight);

      splitPlans.push({
        cut,
        left,
        right,
        leftStop,
        rightStop,
        walkingCost,
        totalCost: walkingCost + stopPenalty * 2
      });
    }
  }

  const bestTwoStopPlan = splitPlans.reduce((best, plan) => {
    if (!best || plan.totalCost < best.totalCost) {
      return plan;
    }

    return best;
  }, null);

  const winner =
    bestTwoStopPlan && bestTwoStopPlan.totalCost < oneStopPlan.totalCost
      ? {
          mode: "two-stop",
          stops: [bestTwoStopPlan.leftStop, bestTwoStopPlan.rightStop],
          totalCost: bestTwoStopPlan.totalCost
        }
      : {
          mode: "one-stop",
          stops: [oneStopPlan.stop],
          totalCost: oneStopPlan.totalCost
        };

  return {
    sorted,
    percentile,
    oneStopPlan,
    splitPlans,
    bestTwoStopPlan,
    winner
  };
}

function App() {
  const [requestCounts, setRequestCounts] = React.useState({
    1: 1,
    2: 1,
    7: 2,
    10: 1
  });
  const [tapHistory, setTapHistory] = React.useState([1, 2, 7, 7, 10]);
  const [showCalculations, setShowCalculations] = React.useState(false);
  const [upWeight, setUpWeight] = React.useState(DEFAULT_SETTINGS.upWeight);
  const [downWeight, setDownWeight] = React.useState(DEFAULT_SETTINGS.downWeight);
  const calculationsRef = React.useRef(null);

  const requests = React.useMemo(() => expandRequests(requestCounts), [requestCounts]);
  const plan = React.useMemo(
    () =>
      chooseBestPlan(
        requests,
        upWeight,
        downWeight,
        DEFAULT_SETTINGS.stopPenalty,
        DEFAULT_SETTINGS.maxStops
      ),
    [requests, upWeight, downWeight]
  );
  const calculationDetails = React.useMemo(
    () =>
      buildCalculationDetails(
        requests,
        upWeight,
        downWeight,
        DEFAULT_SETTINGS.stopPenalty,
        DEFAULT_SETTINGS.maxStops
      ),
    [requests, upWeight, downWeight]
  );

  const activeFloors = React.useMemo(
    () => FLOORS.filter((floor) => requestCounts[floor]).length,
    [requestCounts]
  );

  React.useEffect(() => {
    if (showCalculations && calculationsRef.current) {
      calculationsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showCalculations]);

  function addRequest(floor) {
    setRequestCounts((current) => ({
      ...current,
      [floor]: (current[floor] || 0) + 1
    }));
    setTapHistory((current) => [...current, floor]);
  }

  function undoLastTap() {
    setTapHistory((current) => {
      if (!current.length) {
        return current;
      }

      const floor = current[current.length - 1];

      setRequestCounts((counts) => {
        const nextCounts = { ...counts };
        const nextCount = Math.max(0, (nextCounts[floor] || 0) - 1);

        if (nextCount === 0) {
          delete nextCounts[floor];
        } else {
          nextCounts[floor] = nextCount;
        }

        return nextCounts;
      });

      return current.slice(0, -1);
    });
  }

  function clearQueue() {
    setRequestCounts({});
    setTapHistory([]);
  }

  return (
    <main className="kiosk-shell">
      <div className="tech-overlay" aria-hidden="true" />

      <section className="kiosk-screen">
        <header className="hero-block">
          <p className="brand-mark">LiftPilot</p>
          <p className="hero-kicker">Rush Dispatch Mode</p>
          <h1>TAP A FLOOR. KEEP THE LINE MOVING.</h1>
        </header>

        <section className="floor-matrix" aria-label="Floor request buttons">
          {FLOORS.map((floor) => {
            const count = requestCounts[floor] || 0;
            const isStop = plan.stops.includes(floor);

            return (
              <button
                className={`floor-tile ${count > 0 ? "active" : ""} ${isStop ? "stop-floor" : ""}`}
                key={floor}
                onClick={() => addRequest(floor)}
                type="button"
              >
                <span className="tile-floor">{floor}</span>
                <span className="tile-copy">{count ? `${count} queued` : "Tap to request"}</span>
                {isStop ? <span className="tile-flag">Stop</span> : null}
              </button>
            );
          })}
        </section>

        <section className="bottom-dock">
          <div className="stoppage-panel">
            <div className="stoppage-copy">
              <p className="dock-kicker">Live Output</p>
              <h2>STOPPAGES</h2>
            </div>

            <div className="dock-stats">
              <div className="stat-chip">
                <span>Riders</span>
                <strong>{requests.length}</strong>
              </div>
              <div className="stat-chip">
                <span>Active floors</span>
                <strong>{activeFloors}</strong>
              </div>
              <div className="stat-chip">
                <span>Total cost</span>
                <strong>{plan.cost}</strong>
              </div>
            </div>

            <div className="dock-actions">
              <button className="action-button" onClick={undoLastTap} type="button">
                Undo last tap
              </button>
              <button className="action-button ghost" onClick={clearQueue} type="button">
                Clear queue
              </button>
              <button
                aria-expanded={showCalculations}
                className={`action-button details-toggle ${showCalculations ? "open" : ""}`}
                onClick={() => setShowCalculations((current) => !current)}
                type="button"
              >
                <span>{showCalculations ? "Hide calculations" : "Show calculations"}</span>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M6 9.5 12 15.5 18 9.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                </svg>
              </button>
            </div>
          </div>

          {[0, 1].map((index) => (
            <div className="stop-box" key={index}>
              <span>Stop {index + 1}</span>
              <strong>{plan.stops[index] ?? "--"}</strong>
            </div>
          ))}
        </section>
      </section>

      {showCalculations ? (
        <section className="calc-panel" ref={calculationsRef}>
          <div className="calc-header">
            <div>
              <p className="dock-kicker">Detailed Calculation</p>
              <h2>Why these stoppages were chosen</h2>
            </div>
            <p className="calc-copy">
              The scheduler sorts the requests, tests the weighted-percentile single-stop
              option, then compares it against every possible two-group split with a stop
              penalty added for each lift stop.
            </p>
          </div>

          {calculationDetails ? (
            <>
              <div className="calc-grid">
                <article className="calc-card">
                  <span>Sorted requests</span>
                  <strong>{calculationDetails.sorted.join(", ")}</strong>
                </article>
                <article className="calc-card">
                  <span>Weighted percentile</span>
                  <strong>
                    {Math.round(calculationDetails.percentile * 100)}% = {upWeight} / (
                    {upWeight} + {downWeight})
                  </strong>
                </article>
                <article className="calc-card">
                  <span>Best 1-stop plan</span>
                  <strong>
                    Stop {calculationDetails.oneStopPlan.stop} / walk {calculationDetails.oneStopPlan.walkingCost} /
                    total {calculationDetails.oneStopPlan.totalCost}
                  </strong>
                </article>
                <article className="calc-card">
                  <span>Winning choice</span>
                  <strong>
                    {calculationDetails.winner.mode === "two-stop" ? "Two stops" : "One stop"}:
                    {" "}
                    {calculationDetails.winner.stops.join(" + ")} / total {calculationDetails.winner.totalCost}
                  </strong>
                </article>
              </div>

              <div className="explain-stack">
                <div className="slider-grid">
                  <label className="calc-slider">
                    <span>Stair go up cost</span>
                    <div className="slider-row">
                      <input
                        max="10"
                        min="1"
                        onChange={(event) => setUpWeight(Number(event.target.value))}
                        type="range"
                        value={upWeight}
                      />
                      <strong>{upWeight}</strong>
                    </div>
                  </label>

                  <label className="calc-slider">
                    <span>Stair go down cost</span>
                    <div className="slider-row">
                      <input
                        max="10"
                        min="1"
                        onChange={(event) => setDownWeight(Number(event.target.value))}
                        type="range"
                        value={downWeight}
                      />
                      <strong>{downWeight}</strong>
                    </div>
                  </label>
                </div>

                <div className="explain-line">
                  Upstairs walking is weighted higher than downstairs walking: `up = {upWeight}`,
                  `down = {downWeight}`.
                </div>
                <div className="explain-line">
                  Each lift stop adds a penalty of `{DEFAULT_SETTINGS.stopPenalty}`, so extra
                  stops only win if they reduce enough stair-walking cost.
                </div>
                <div className="explain-line">
                  For one stop, the engine picks the{" "}
                  {Math.round(calculationDetails.percentile * 100)}th percentile floor from the
                  sorted requests.
                </div>
                <div className="explain-line">
                  For two stops, it tries every possible split and keeps the lowest total cost with
                  max stops fixed at {DEFAULT_SETTINGS.maxStops}.
                </div>
              </div>

              <div className="calc-table">
                <div className="calc-row calc-head">
                  <span>Split</span>
                  <span>Left group</span>
                  <span>Right group</span>
                  <span>Stops</span>
                  <span>Walk</span>
                  <span>Total</span>
                </div>

                {calculationDetails.splitPlans.map((split) => {
                  const isBest =
                    calculationDetails.bestTwoStopPlan &&
                    split.cut === calculationDetails.bestTwoStopPlan.cut;

                  return (
                    <div className={`calc-row ${isBest ? "best" : ""}`} key={split.cut}>
                      <span>After #{split.cut + 1}</span>
                      <span>{split.left.join(", ")}</span>
                      <span>{split.right.join(", ")}</span>
                      <span>
                        {split.leftStop} + {split.rightStop}
                      </span>
                      <span>{split.walkingCost}</span>
                      <span>{split.totalCost}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="calc-copy">Tap some floors first, then open the calculations panel.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}

export default App;
