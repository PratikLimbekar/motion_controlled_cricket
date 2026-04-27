import 'dart:async';
import 'package:sensors_plus/sensors_plus.dart';

class MotionService {
  StreamSubscription<AccelerometerEvent>? _accSub;
  StreamSubscription<GyroscopeEvent>? _gyroSub;

  List<double> _latestAcc = [0.0, 0.0, 0.0];
  List<double> _latestGyro = [0.0, 0.0, 0.0];

  Timer? _timer;

  void startReading(Function(List<double> acc, List<double> gyro) onDataReady) {
    _accSub = accelerometerEventStream().listen((AccelerometerEvent event) {
      _latestAcc = [event.x, event.y, event.z];
    });

    _gyroSub = gyroscopeEventStream().listen((GyroscopeEvent event) {
      _latestGyro = [event.x, event.y, event.z];
    });

    // Send at ~50 Hz (every 20ms)
    _timer = Timer.periodic(const Duration(milliseconds: 20), (timer) {
      onDataReady(_latestAcc, _latestGyro);
    });
  }

  void stopReading() {
    _accSub?.cancel();
    _gyroSub?.cancel();
    _timer?.cancel();
  }
}
