export default function Dashboard() {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">📊 Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-gray-500 text-sm">Total Files</h3>
          <p className="text-2xl font-bold mt-2">1,245</p>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-gray-500 text-sm">Storage Used</h3>
          <p className="text-2xl font-bold mt-2">32 GB</p>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-gray-500 text-sm">Active Users</h3>
          <p className="text-2xl font-bold mt-2">18</p>
        </div>
      </div>
    </div>
  );
}
