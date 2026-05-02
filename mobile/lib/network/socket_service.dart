import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class SocketService {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  String _currentIp = '';

  // Notifier so the UI can react to connection state changes
  final ValueNotifier<bool> isConnectedNotifier = ValueNotifier(false);

  bool get isConnected => _isConnected;

  void connect(String ip) {
    _currentIp = ip;
    _connectInternal(ip);
  }

  void _connectInternal(String ip) {
    try {
      final uri = Uri.parse('ws://$ip:8080');
      _channel = WebSocketChannel.connect(uri);

      // ⚠️ CRITICAL: Must listen to stream for WebSocket to be fully functional
      _channel!.stream.listen(
        (message) {
          // Incoming messages from server (not used in mobile, but required)
        },
        onDone: () {
          print('WebSocket closed.');
          _setConnected(false);
        },
        onError: (e) {
          print('WebSocket error: $e');
          _setConnected(false);
        },
      );

      // Use the ready future to confirm handshake before marking connected
      _channel!.ready.then((_) {
        print('WebSocket connected to $ip');
        _channel?.sink.add(jsonEncode({
          'type': 'register',
          'clientType': 'mobile',
        }));
        _setConnected(true);
      }).catchError((e) {
        print('WebSocket ready error: $e');
        _setConnected(false);
      });

    } catch (e) {
      print('Socket connection error: $e');
      _setConnected(false);
    }
  }

  void _setConnected(bool value) {
    _isConnected = value;
    isConnectedNotifier.value = value;
  }

  void sendMotionData(List<double> acc, List<double> gyro) {
    if (_isConnected && _channel != null) {
      _channel?.sink.add(jsonEncode({
        'type': 'motion',
        'data': {
          'acc': acc,
          'gyro': gyro,
        }
      }));
    }
  }

  void sendAction(String action, [Map<String, dynamic>? data]) {
    print('[SocketService] sendAction called: $action, isConnected=$_isConnected, channel=${_channel != null}');
    try {
      final Map<String, dynamic> payload = {
        'type': 'action',
        'action': action,
      };
      if (data != null) payload.addAll(data);
      
      _channel?.sink.add(jsonEncode(payload));
      print('[SocketService] action sent: $action with data $data');
    } catch (e) {
      print('[SocketService] sendAction error: $e');
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _setConnected(false);
  }
}
