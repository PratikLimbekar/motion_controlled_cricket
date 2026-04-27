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
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
        useMaterial3: true,
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

  @override
  void initState() {
    super.initState();
    // Use a single listener to handle all connection state changes
    _socketService.isConnectedNotifier.addListener(_handleConnectionChange);
  }

  void _handleConnectionChange() {
    final connected = _socketService.isConnectedNotifier.value;
    
    if (connected && _isConnecting) {
      // Successfully connected after user clicked CONNECT
      _motionService.startReading((acc, gyro) {
        _socketService.sendMotionData(acc, gyro);
      });
      setState(() {
        _isStreaming = true;
        _isConnecting = false;
      });
      print('[DEBUG] Connection established, streaming started.');
    } else if (!connected && (_isStreaming || _isConnecting)) {
      // Disconnected or connection failed
      _motionService.stopReading();
      setState(() {
        _isStreaming = false;
        _isConnecting = false;
      });
      print('[DEBUG] Disconnected or connection failed.');
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
      _socketService.disconnect(); // This will trigger the listener
    } else {
      final ip = _ipController.text.trim();
      if (ip.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enter an IP address')),
        );
        return;
      }
      
      setState(() => _isConnecting = true);
      print('[DEBUG] Attempting to connect to $ip...');
      _socketService.connect(ip);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Motion Controller"),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _ipController,
              decoration: const InputDecoration(
                labelText: 'Server IP',
                hintText: 'e.g., 192.168.1.10',
                border: OutlineInputBorder(),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _isConnecting ? null : _toggleConnection,
              style: ElevatedButton.styleFrom(
                backgroundColor: _isStreaming 
                    ? Colors.red 
                    : (_isConnecting ? Colors.orange : Colors.green),
                minimumSize: const Size(double.infinity, 60),
              ),
              child: Text(
                _isStreaming 
                    ? "DISCONNECT" 
                    : (_isConnecting ? "CONNECTING..." : "CONNECT"),
                style: const TextStyle(fontSize: 24, color: Colors.white),
              ),
            ),
            if (_isStreaming) ...[
              const SizedBox(height: 32),
              ValueListenableBuilder<bool>(
                valueListenable: _socketService.isConnectedNotifier,
                builder: (context, isConnected, _) {
                  return ElevatedButton(
                    onPressed: isConnected
                        ? () {
                            print('[UI] NEXT BALL button tapped');
                            _socketService.sendAction('next_ball');
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isConnected ? Colors.blue : Colors.grey,
                      minimumSize: const Size(double.infinity, 60),
                    ),
                    child: Text(
                      isConnected ? "NEXT BALL" : "Waiting for Socket...",
                      style: const TextStyle(fontSize: 24, color: Colors.white),
                    ),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
