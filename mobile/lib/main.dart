import 'package:flutter/material.dart';
import 'network/socket_service.dart';
import 'sensors/motion_service.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cricket Controller',
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const ControllerScreen(),
    );
  }
}

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  final SocketService _socketService = SocketService();
  final MotionService _motionService = MotionService();
  
  final TextEditingController _ipController = TextEditingController();
  bool _isStreaming = false;
  bool _isConnecting = false;
  
  String _shotMode = 'none'; // 'none', 'loft', 'stroke'

  @override
  void initState() {
    super.initState();
    _socketService.isConnectedNotifier.addListener(_handleConnectionChange);
  }

  void _handleConnectionChange() {
    final connected = _socketService.isConnectedNotifier.value;
    if (connected && _isConnecting) {
      _motionService.startReading((acc, gyro) {
        _socketService.sendMotionData(acc, gyro);
      });
      setState(() {
        _isStreaming = true;
        _isConnecting = false;
      });
    } else if (!connected && (_isStreaming || _isConnecting)) {
      _motionService.stopReading();
      setState(() {
        _isStreaming = false;
        _isConnecting = false;
        _shotMode = 'none';
      });
    }
  }

  @override
  void dispose() {
    _socketService.isConnectedNotifier.removeListener(_handleConnectionChange);
    _socketService.disconnect();
    _motionService.stopReading();
    super.dispose();
  }

  void _toggleConnection() {
    if (_isStreaming || _isConnecting) {
      _socketService.disconnect();
    } else {
      final ip = _ipController.text.trim();
      if (ip.isEmpty) return;
      setState(() => _isConnecting = true);
      _socketService.connect(ip);
    }
  }

  void _setShotMode(String mode) {
    setState(() {
      if (_shotMode == mode) {
        _shotMode = 'none';
      } else {
        _shotMode = mode;
      }
    });
    _socketService.sendAction('set_shot_mode', {'mode': _shotMode});
  }

  @override
  Widget build(BuildContext context) {
    if (!_isStreaming) {
      return Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Colors.blue.shade900, Colors.black],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.sports_cricket, size: 80, color: Colors.blue),
                const SizedBox(height: 24),
                const Text(
                  "CRICKET CONTROLLER",
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 2),
                ),
                const SizedBox(height: 48),
                TextField(
                  controller: _ipController,
                  decoration: InputDecoration(
                    labelText: 'SERVER IP',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white.withOpacity(0.05),
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isConnecting ? null : _toggleConnection,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue.shade600,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 60),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(_isConnecting ? "CONNECTING..." : "CONNECT", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Background Gradient
          Container(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.2,
                colors: [Colors.blue.withOpacity(0.15), Colors.black],
              ),
            ),
          ),
          
          // Main UI
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  // Top Row: Disconnect
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      IconButton(
                        onPressed: _toggleConnection,
                        icon: const Icon(Icons.power_settings_new, color: Colors.redAccent, size: 30),
                        tooltip: 'Disconnect',
                      ),
                    ],
                  ),
                  
                  const Spacer(),
                  
                  // Next Ball Button (Primary Action)
                  GestureDetector(
                    onTap: () => _socketService.sendAction('next_ball'),
                    child: Container(
                      height: 140,
                      width: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Colors.blue.shade400, Colors.blue.shade700],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.blue.withOpacity(0.4),
                            blurRadius: 20,
                            spreadRadius: 5,
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          "BOWL",
                          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 1),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 40),
                  
                  // Shot Mode Toggles (NOW BELOW BOWL)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _buildModeButton(
                        label: 'STROKE',
                        icon: Icons.horizontal_rule,
                        isActive: _shotMode == 'stroke',
                        color: Colors.greenAccent,
                        onTap: () => _setShotMode('stroke'),
                      ),
                      _buildModeButton(
                        label: 'LOFT',
                        icon: Icons.vertical_align_top,
                        isActive: _shotMode == 'loft',
                        color: Colors.orangeAccent,
                        onTap: () => _setShotMode('loft'),
                      ),
                    ],
                  ),
                  
                  const Spacer(),
                  
                  // Bottom Row: Scorecard
                  Row(
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: [
                      ElevatedButton.icon(
                        onPressed: () => _socketService.sendAction('toggle_scorecard'),
                        icon: const Icon(Icons.analytics_outlined, size: 20),
                        label: const Text("SCORECARD"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.1),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeButton({
    required String label,
    required IconData icon,
    required bool isActive,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 120,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: isActive ? color.withOpacity(0.2) : Colors.white.withOpacity(0.05),
          border: Border.all(
            color: isActive ? color : Colors.white.withOpacity(0.1),
            width: 2,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, color: isActive ? color : Colors.white54),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: isActive ? color : Colors.white54,
                fontWeight: FontWeight.bold,
                fontSize: 14,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
