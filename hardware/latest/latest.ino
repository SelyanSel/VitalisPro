#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_RGBLCDShield.h>
#include <utility/Adafruit_MCP23017.h>

// variables rfid
#define SS_PIN 10
#define RST_PIN 9
#define BUZZ 5
MFRC522 rfid(SS_PIN, RST_PIN);

// variables lcd
Adafruit_RGBLCDShield lcd = Adafruit_RGBLCDShield();

// switch pin
#define SWITCH 2
int switchSaveVal = LOW;

// générateur de json perosnnalisé

class JSONMaker {
  private:
    String buffer;
    bool firstItem;

  public:
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

    void end() {
      buffer += "}";
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

bool waitForServerCallback = false;
bool OKCallback = false;
bool registerMode = false;
bool regMem = false;
int callbackTimer = 0;
String arduinoID = "VT_A_Portique-01";
JSONMaker json;

// alive timer
int aliveT = 0;

void setup() {
  pinMode(BUZZ, OUTPUT);
  pinMode(SWITCH, INPUT_PULLUP);
  // rfid setup
  SPI.begin();
  rfid.PCD_Init();

  // lcd setup
  lcd.begin(16, 2);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Sync en cours");
  delay(1);
  lcd.setCursor(0, 1);
  lcd.print(arduinoID);

  delay(3000);

  lcd.clear();
  lcd.print("Approchez votre");
  lcd.setCursor(0, 1);
  lcd.print("badge svp...");

  lcd.setBacklight(0x7);
  Serial.begin(9600);

  int switchStatus = digitalRead(SWITCH);
  switchSaveVal = digitalRead(SWITCH);

  if (switchStatus == HIGH) {
    digitalWrite(BUZZ, HIGH);
    delay(50);
    digitalWrite(BUZZ, LOW);
  }

  heartbeat();
}

void registerRFID() {
  if (Serial.available() > 0) {
    String res = Serial.readStringUntil("\n");
    res.trim();

    if (res == "-5") {
      lcd.clear();
      lcd.print("Annulation");
      lcd.setCursor(0, 1);
      delay(5);
      lcd.print(arduinoID);
      delay(2500);

      registerMode = false;

      lcd.clear();
      lcd.print("Approchez votre");
      lcd.setCursor(0, 1);
      delay(5);
      lcd.print("badge svp...");

      delay(1000);
      return;
    }
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    if (aliveT < 100) {
      aliveT++;
    } else {
      aliveT = 0;

      heartbeat();
    }

    return;
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Lecture...");

  // lire carte
  lcd.setCursor(0, 1);
  String tagID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      tagID += "0";
    }
    tagID += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) {
      tagID += "-";
    }
  }

  tagID.toUpperCase();

  // créer json

  json.begin();  // initialiser json

  json.add("type", "RFID_REGISTER_SCAN");
  json.add("uid", tagID);

  json.end();  // terminer json

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Attente d'instruction");
  lcd.setCursor(0, 1);
  delay(1);
  lcd.print(arduinoID);

  Serial.println(json.get());

  waitForServerCallback = true;
  OKCallback = true;
  registerMode = false;
  regMem = true;

  rfid.PICC_HaltA();

  return;
}

void loop() {
  int switchStatus = digitalRead(SWITCH);

  if (switchStatus != switchSaveVal) {
    switchSaveVal = digitalRead(SWITCH);

    if (switchStatus == HIGH) {
      digitalWrite(BUZZ, HIGH);
      delay(25);
      digitalWrite(BUZZ, LOW);
      delay(25);
      digitalWrite(BUZZ, HIGH);
      delay(25);
      digitalWrite(BUZZ, LOW);
    } else {
      digitalWrite(BUZZ, HIGH);
      delay(200);
      digitalWrite(BUZZ, LOW);
    }
  }
  if (registerMode) {
    registerRFID();
    return;
  }
  // si une carte a été scannée, on attends la réponse
  if (waitForServerCallback) {
    if (!OKCallback) {
      if (Serial.available() > 0) {
        String res = Serial.readStringUntil("\n");

        if (res == "0") {
          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("Authentification...");
          OKCallback = true;
        } else {
          lcd.setCursor(0, 1);
          lcd.print(res);
          return;
        }
      } else {
        callbackTimer += 1;
        delay(1);

        if (callbackTimer > 1000) {
          callbackTimer = 0;

          lcd.clear();
          lcd.print("Erreur serveur");
          lcd.setCursor(0, 1);
          lcd.print("ERR_UNREACHABLE");

          delay(5000);

          lcd.clear();
          lcd.print("Approchez votre");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print("badge svp...");

          waitForServerCallback = false;
          OKCallback = false;
          return;
        }
        return;
      }
    }
    if (Serial.available() > 0) {
      String res = Serial.readStringUntil("\n");
      res.trim();

      if (regMem) {
        if (res == "-5") {
          lcd.clear();
          lcd.print("Annulation");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print(arduinoID);
          delay(2500);

          registerMode = false;
          regMem = false;
          waitForServerCallback = false;
          OKCallback = false;

          lcd.clear();
          lcd.print("Approchez votre");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print("badge svp...");

          delay(1000);
          return;
        }
        if (res == "3") {
          lcd.clear();
          lcd.print("Succes");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print(arduinoID);
          delay(2500);

          registerMode = false;
          regMem = false;
          waitForServerCallback = false;
          OKCallback = false;

          lcd.clear();
          lcd.print("Approchez votre");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print("badge svp...");

          delay(1000);
          return;
        }
      }

      // parse response

      int vRes = res.indexOf(',');
      if (vRes != -1) {

        String serverStatusString = res.substring(0, vRes);
        int servStatus = serverStatusString.toInt();

        String user = res.substring(vRes + 1);

        // 0 = accès autorisé
        // 1 = abonnement expiré
        // 2 = badge inconnu
        // 3 = register ok
        // -5 = register annulé

        // -1 = erreur serveur
        if (servStatus == -1) {
          lcd.clear();
          lcd.print("Erreur scan, merci");
          lcd.setCursor(0, 1);
          lcd.print("de reessayer.");

          if (switchStatus == HIGH) {
            digitalWrite(BUZZ, HIGH);
            delay(50);
            digitalWrite(BUZZ, LOW);
            delay(50);
            digitalWrite(BUZZ, HIGH);
            delay(50);
            digitalWrite(BUZZ, LOW);
          }

          delay(3000);

          lcd.clear();
          lcd.print("Approchez votre");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print("badge svp...");

          waitForServerCallback = false;
          OKCallback = false;
          return;
        }

        if (servStatus == 0) {
          lcd.clear();
          lcd.print("Bienvenue");
          lcd.setCursor(0, 1);
          lcd.print(user);

          if (switchStatus == HIGH) {
            digitalWrite(BUZZ, HIGH);
            delay(500);
            digitalWrite(BUZZ, LOW);
          }

          delay(3000);

          lcd.clear();
          lcd.print("Approchez votre");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print("badge svp...");

          waitForServerCallback = false;
          OKCallback = false;
          return;
        } else if (servStatus == 1) {
          lcd.clear();
          lcd.print("Votre abonnement");
          lcd.setCursor(0, 1);
          lcd.print("a expire!");

          if (switchStatus == HIGH) {
            digitalWrite(BUZZ, HIGH);
            delay(50);
            digitalWrite(BUZZ, LOW);
            delay(50);
            digitalWrite(BUZZ, HIGH);
            delay(50);
            digitalWrite(BUZZ, LOW);
          }

          delay(3000);

          lcd.clear();
          lcd.print("Approchez votre");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print("badge svp...");

          waitForServerCallback = false;
          OKCallback = false;
          return;
        } else if (servStatus == 2) {
          lcd.clear();
          lcd.print("Badge inconnu!");

          if (switchStatus == HIGH) {
            digitalWrite(BUZZ, HIGH);
            delay(50);
            digitalWrite(BUZZ, LOW);
            delay(50);
            digitalWrite(BUZZ, HIGH);
            delay(50);
            digitalWrite(BUZZ, LOW);
          }

          delay(3000);

          lcd.clear();
          lcd.print("Approchez votre");
          lcd.setCursor(0, 1);
          delay(5);
          lcd.print("badge svp...");

          waitForServerCallback = false;
          OKCallback = false;
          return;
        }

      } else {
        return;
      }
    } else {
      return;
    }
  }

  if (Serial.available() > 0) {
    String res = Serial.readStringUntil("\n");
    res.trim();

    if (res == "-1") {
      registerMode = true;
      lcd.clear();
      lcd.print("Enregistrement --");
      lcd.setCursor(0, 1);
      delay(5);
      lcd.print("Attente badge...");
      return;
    }
  }

  // chercher carte
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    if (aliveT < 100) {
      aliveT++;
    } else {
      aliveT = 0;

      heartbeat();
    }

    return;
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Lecture...");

  // lire carte
  lcd.setCursor(0, 1);
  String tagID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      tagID += "0";
    }
    tagID += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) {
      tagID += "-";
    }
  }

  tagID.toUpperCase();

  // créer json

  json.begin();  // initialiser json

  json.add("type", "RFID_SCAN");
  json.add("uid", tagID);

  json.end();  // terminer json

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connexion...");

  Serial.println(json.get());

  waitForServerCallback = true;
  OKCallback = false;

  rfid.PICC_HaltA();

  return;
}

void heartbeat() {
  json.begin();  // initialiser json
  json.add("type", "ALIVE_HEARTBEAT");
  json.end();  // terminer json
  Serial.println(json.get());
}
