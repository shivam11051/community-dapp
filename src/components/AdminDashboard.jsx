import React, { useState, useEffect } from "react";
import { useWeb3 } from "../context/Web3Context";

export default function AdminDashboard() {
  const { account } = useWeb3();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    checkAdmin();
    fetchStats();
    fetchAnalytics();
  }, [account]);

  const checkAdmin = async () => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/admin/check/${account}`
      );
      const data = await response.json();
      setIsAdmin(data.isAdmin);
    } catch (error) {
      console.error("Admin check failed:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("http://localhost:5001/api/admin/stats");
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("http://localhost:5001/api/analytics/dashboard");
      const data = await response.json();
      setAnalytics(data.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  if (!isAdmin) {
    return <div className="error">❌ Admin access required</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>🔐 Admin Dashboard</h1>

      <section className="admin-stats">
        <h2>System Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Groups</h3>
            <p className="count">{stats?.totalGroups}</p>
          </div>
          <div className="stat-card">
            <h3>Active Groups</h3>
            <p className="count">{stats?.activeGroups}</p>
          </div>
          <div className="stat-card">
            <h3>Total Events</h3>
            <p className="count">{stats?.totalEvents}</p>
          </div>
        </div>
      </section>

      <section className="analytics">
        <h2>📈 Platform Analytics</h2>
        <div className="analytics-grid">
          <div className="chart">
            <h3>Groups Overview</h3>
            <div className="data">
              <p>Active: {analytics?.groups?.active}</p>
              <p>Closed: {analytics?.groups?.closed}</p>
            </div>
          </div>

          <div className="chart">
            <h3>Event Activity</h3>
            <div className="data">
              <p>EMI Payments: {analytics?.events?.emiPayments}</p>
              <p>Votes: {analytics?.events?.votes}</p>
              <p>New Members: {analytics?.events?.newMembers}</p>
            </div>
          </div>

          <div className="chart">
            <h3>Platform Metrics</h3>
            <div className="data">
              <p>Avg Credit: {analytics?.metrics?.averageCreditScore}/100</p>
              <p>Avg Size: {analytics?.metrics?.avgGroupSize} members</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}