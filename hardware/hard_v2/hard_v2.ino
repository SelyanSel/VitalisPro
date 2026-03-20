// ---------
// Code Arduino
// Version 2 - selyansel | 18 March 2026
// ---------
// I decided to rewrite the entire arduino part because it would
// be SO more difficult to adapt the current code. And I can
// do a lot more optimizations.
// I'll try to comment as much as possible this time.
//
// NOTE : Yet need to add the HUSKYLENS facial recognition part.
// ---------
// mac rfid / gen : A8:61:0A:AE:77:79
// mac facial : 90:A2-DA-10-FE-47
// ---------

// Librairies
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_RGBLCDShield.h>
#include <utility/Adafruit_MCP23017.h>
#include <Ethernet.h>
#include "JSONMaker.h"

// Ethernet Setup
byte mac[] = { 0xA8, 0x61, 0x0A, 0xAE, 0x77, 0x79 };  // This is defined on the back of the arduino.
IPAddress arduinoIP(192, 168, 1, 40);                 // Defined arduino IP
String arduinoIPstr = "192.168.1.40";                 // it's easier ngl (i'm lazy)
IPAddress serverIP(192, 168, 1, 50);                  // Defined server address
int serverPort = 9961;                                // ARBITRARY : should implement a discover feature?
EthernetClient client;

// rfid variables
#define SS_PIN 8
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

// lcd variables
Adafruit_RGBLCDShield lcd = Adafruit_RGBLCDShield();

// other variables
#define SWITCH 2
#define BUZZ 5
int switchSaveVal = LOW;
bool waitForServerCallback = false;
bool OKCallback = false;
bool registerMode = false;
bool regMem = false;
int callbackTimer = 0;
String arduinoID = "VT_A_Portique v2";
JSONMaker json;
int aliveT = 0;
bool syncState = true;

void setup() {
  pinMode(BUZZ, OUTPUT);
  pinMode(SWITCH, INPUT_PULLUP);
  // rfid setup
  SPI.begin();
  rfid.PCD_Init();

  // ethernet setup
  Ethernet.begin(mac, arduinoIP);

  // lcd setup
  lcd.begin(16, 2);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Sync en cours...");
  delay(1);
  lcd.setCursor(0, 1);
  lcd.print(arduinoID);

  lcd.setBacklight(0x7);
  Serial.begin(9600);

  int switchStatus = digitalRead(SWITCH);
  switchSaveVal = digitalRead(SWITCH);

  heartbeat();

  if (!client.connected()) {
    client.connect(serverIP, serverPort);
  }
}

void heartbeat() {
  json.begin();
  json.add("type", "ALIVE_HEARTBEAT");
  json.end();
  pushServer(json.get());
}

void registerRFID() {
  if (client.available()) {
    String res = client.readStringUntil('\n');
    res.trim();

    if (res == "-5") {
      lcd.clear();
      lcd.print("Annulation");
      lcd.setCursor(0, 1);
      delay(5);
      lcd.print(arduinoID);
      delay(2500);

      registerMode = false;

      resetUI();

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

  pushServer(json.get());

  waitForServerCallback = true;
  OKCallback = true;
  registerMode = false;
  regMem = true;

  rfid.PICC_HaltA();

  return;
}

void loop() {
  int switchStatus = digitalRead(SWITCH);

  if (syncState) {
    if (!client.connected()) {
      client.connect(serverIP, serverPort);
      return;  // prevent client void
    }

    if (client.available()) {
      String res = client.readStringUntil('\n');
      res.trim();
      int vRes = res.indexOf(',');
      if (vRes != -1) {

        String serverStatusString = res.substring(0, vRes);
        int servStatus = serverStatusString.toInt();

        String eKey = res.substring(vRes + 1);
        json.defineKey(eKey.toInt());

        resetUI();
        toneBuzz(50);
        syncState = false;
      }
    }

    json.begin();
    json.add("type", "INIT");
    json.add("ip", arduinoIPstr);
    json.end(false);

    pushServer(json.get());
  }

  if (switchStatus != switchSaveVal) {
    switchSaveVal = digitalRead(SWITCH);

    if (switchStatus == HIGH) {
      toneBuzz(25);
      delay(25);
      toneBuzz(25);
    } else {
      toneBuzz(200);
    }
  }
  if (registerMode) {
    registerRFID();
    return;
  }
  // si une carte a été scannée, on attends la réponse
  if (waitForServerCallback) {
    if (!OKCallback) {
      if (client.available()) {
        String res = client.readStringUntil('\n');

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

          resetUI();

          waitForServerCallback = false;
          OKCallback = false;
          return;
        }
        return;
      }
    }
    if (client.available()) {
      String res = client.readStringUntil('\n');
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

          resetUI();

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

          resetUI();

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
            toneBuzz(50);
            delay(50);
            toneBuzz(50);
          }

          delay(3000);

          resetUI();

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
            toneBuzz(500);
          }

          delay(3000);

          resetUI();

          waitForServerCallback = false;
          OKCallback = false;
          return;
        } else if (servStatus == 1) {
          lcd.clear();
          lcd.print("Votre abonnement");
          lcd.setCursor(0, 1);
          lcd.print("a expire!");

          if (switchStatus == HIGH) {
            toneBuzz(50);
            delay(50);
            toneBuzz(50);
          }

          delay(3000);

          resetUI();

          waitForServerCallback = false;
          OKCallback = false;
          return;
        } else if (servStatus == 2) {
          lcd.clear();
          lcd.print("Badge inconnu!");

          if (switchStatus == HIGH) {
            toneBuzz(50);
            delay(50);
            toneBuzz(50);
          }

          delay(3000);

          resetUI();

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

  if (client.available()) {
    String res = client.readStringUntil('\n');
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

  pushServer(json.get());

  waitForServerCallback = true;
  OKCallback = false;

  rfid.PICC_HaltA();

  return;
}

// Server communication
void pushServer(String msg) {
  if (!client.connected()) {
    client.connect(serverIP, serverPort);
  }
  if (client.connected()) {
    client.println(msg);
  }
}

// Why didn't i think of it sooner? It's way simpler instead of
// doing a spaghetti of code
void resetUI() {
  waitForServerCallback = false;
  OKCallback = false;
  registerMode = false;
  regMem = false;
  lcd.clear();
  lcd.print("Approchez votre");
  lcd.setCursor(0, 1);
  lcd.print("badge svp...");
}

// Quick function to trigger a buzzer tonality (c'est plus simple)
void toneBuzz(int ms) {
  digitalWrite(BUZZ, HIGH);
  delay(ms);
  digitalWrite(BUZZ, LOW);
}