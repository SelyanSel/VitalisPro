// -----
// Lightweight JSON Library
// 2026 selyansel
// -----
// Made for the VitalisPro project.
// The available JSON library was too fucking heavy for just basic JSON handling.
// -----

class JSONMaker {
private:
  String buffer;
  bool firstItem;
  int encryptKey = -1;

public:
  void defineKey(int encryptionKey) {
    encryptKey = encryptionKey;
  }

  void begin() {
    buffer = "{";
    firstItem = true;
  }

  void add(String key, String value) {
    addSeparator();
    buffer += "\"" + key + "\":\"" + value + "\"";
  }

  void add(String key, long value) {
    addSeparator();
    buffer += "\"" + key + "\":" + String(value);
  }

  void add(String key, float value, int precision = 2) {
    addSeparator();
    buffer += "\"" + key + "\":" + String(value, precision);
  }

  void end(bool Encrypt = true) {
    buffer += "}";
    if (Encrypt) {
      if (encryptKey == -1) { return; }; // prevents empty encryption
      for (int i = 0; i < buffer.length(); i++) {
        buffer[i] = buffer[i] ^ (encryptKey & 0xFF);
      }
    }
  }

  String get() {
    return buffer;
  }

private:
  void addSeparator() {
    if (!firstItem) {
      buffer += ",";
    }
    firstItem = false;
  }
};