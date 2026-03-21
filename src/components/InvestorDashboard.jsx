import React, { useState, useEffect } from "react";
import { useWeb3 } from "../context/Web3Context";
import apiService from "../services/apiService";

export default function InvestorDashboard() {
  const { account } = useWeb3();
  const [dashboard, setDashboard] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    fetchOpportunities();
  }, [account]);

  const fetchDashboard = async () => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/investor/dashboard/${account}`
      );
      const data = await response.json();
      setDashboard(data.data);
    } catch (error) {
      console.error("Error fetching investor dashboard:", error);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const response = await fetch(
        "http://localhost:5001/api/investor/opportunities"
      );
      const data = await response.json();
      setOpportunities(data.data);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="investor-dashboard">
      <h1>💼 Investor Dashboard</h1>

      {/* Portfolio Summary */}
      <section className="portfolio-summary">
        <h2>Your Portfolio</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Invested</h3>
            <p className="amount">{dashboard?.totalInvested}</p>
          </div>
          <div className="stat-card">
            <h3>Total Returns</h3>
            <p className="amount success">{dashboard?.totalReturns}</p>
          </div>
          <div className="stat-card">
            <h3>Average ROI</h3>
            <p className="percentage">{dashboard?.averageROI}%</p>
          </div>
          <div className="stat-card">
            <h3>Groups Invested</h3>
            <p className="count">{dashboard?.investedGroups}</p>
          </div>
        </div>
      </section>

      {/* Investment Opportunities */}
      <section className="opportunities">
        <h2>🎯 Investment Opportunities</h2>
        <div className="opportunities-list">
          {opportunities.map((group) => (
            <div key={group.gid} className="opportunity-card">
              <div className="header">
                <h3>{group.name}</h3>
                <span className="investment-score">
                  Score: {group.investmentScore}/100
                </span>
              </div>

              <div className="metrics-grid">
                <div className="metric">
                  <label>Credit Score</label>
                  <p>{group.health?.averageCreditScore}/100</p>
                </div>
                <div className="metric">
                  <label>Group Fill</label>
                  <p>{group.health?.fillPercentage}%</p>
                </div>
                <div className="metric">
                  <label>Expected ROI</label>
                  <p>{group.roi?.roiPercentage}%</p>
                </div>
                <div className="metric">
                  <label>Default Risk</label>
                  <p>{group.roi?.defaultRate}%</p>
                </div>
              </div>

              <div className="health-bars">
                <div className="bar-item">
                  <label>On-Time Payers</label>
                  <div className="progress-bar">
                    <div
                      className="progress"
                      style={{
                        width: `${(group.health?.onTimeMemberCount / group.metrics?.totalMembers) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <button className="invest-btn">Invest in Group</button>
            </div>
          ))}
        </div>
      </section>

      {/* Portfolio Details */}
      <section className="portfolio-details">
        <h2>📊 Your Investments</h2>
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Members</th>
              <th>Credit Score</th>
              <th>ROI %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dashboard?.portfolio?.map((group) => (
              <tr key={group.gid}>
                <td>{group.name}</td>
                <td>{group.memberCount}</td>
                <td>{group.health?.averageCreditScore}</td>
                <td className="positive">{group.roi?.roiPercentage}%</td>
                <td className={`status-${group.status}`}>
                  {getStatusLabel(group.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function getStatusLabel(status) {
  const labels = ["Open", "Active", "Defaulted", "Closed"];
  return labels[status] || "Unknown";
}