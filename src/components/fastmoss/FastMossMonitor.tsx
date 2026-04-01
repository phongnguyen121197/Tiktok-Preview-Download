/**
 * FastMoss Monitor Dashboard (Stub for v2.0)
 * 
 * @author Phongdepzai
 * @version 2.0.0
 */

import React from 'react';
import { Activity, Users, Gauge, AlertTriangle } from 'lucide-react';
import Card from '../ui/Card';

export function FastMossMonitor() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tiktok-cyan to-blue-500 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white">FastMoss Monitor</h1>
            <p className="text-sm text-white/50">Multi-user session management</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-white/50">Active Users</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-white/50">Available Sessions</p>
              <p className="text-2xl font-bold text-white">50</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-white/50">Queue Size</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">v2.0 Feature Coming Soon</h3>
          <p className="text-white/50 max-w-md mx-auto">
            Multi-user FastMoss session pooling will be available in a future update.
            This will allow up to 50 concurrent users to share 2 Premium accounts.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default FastMossMonitor;
