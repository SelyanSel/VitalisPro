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

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_RGBLCDShield.h>
#include <utility/Adafruit_MCP23017.h>
#include <Ethernet.h>
#include "JSONMaker.h"

// Ethernet Setup
byte mac[] = { 0x90, 0xA2, 0xDA, 0x10, 0xFE, 0x47 };  // This is defined on the back of the arduino.
IPAddress arduinoIP(192, 168, 1, 41);                 // Defined arduino IP
String arduinoIPstr = "192.168.1.41";                 // it's easier ngl (i'm lazy)
IPAddress serverIP(192, 168, 1, 50);                  // Defined server address
int serverPort = 9961;                                // ARBITRARY : should implement a discover feature?
EthernetClient client;
String arduinoID = "ARD_Recon";
JSONMaker json;
int cnt = 0;
bool syncState = true;

void setup() {
  // put your setup code here, to run once:
  Ethernet.begin(mac, arduinoIP);
  Serial.begin(115200);


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

void pushServer(String msg) {
  if (!client.connected()) {
    client.connect(serverIP, serverPort);
  }
  if (client.connected()) {
    client.println(msg);
  }
}

void loop() {
  if (!client.connected()) {
    if (!syncState) {
      Serial.println("Lost connection !");
      client.connect(serverIP, serverPort);
      syncState = true;
      return;
    }
  }

  if (syncState) {
    if (!client.connected()) {
      client.connect(serverIP, serverPort);
      Serial.println("CONNECT_REQ");
      return;
    }

    if (client.available()) {
      Serial.println("----");
      String res = client.readStringUntil('\n');
      res.trim();
      int vRes = res.indexOf(',');
      if (vRes != -1) {

        String serverStatusString = res.substring(0, vRes);
        int servStatus = serverStatusString.toInt();

        int eKey = res.substring(vRes + 1).toInt();
        json.defineKey(eKey);
        Serial.println("Connect success //");
        Serial.print("ENCRYPT_KEY: ");
        Serial.println(eKey);

        if (servStatus != 0) {
          return;
        }

        syncState = false;
        Serial.println("----");
        return;
      }
    }

    json.begin();
    json.add("type", "INIT");
    json.add("ip", arduinoIPstr);
    json.add("pid", arduinoID);
    json.end(false);
    Serial.println("Push init request...");

    pushServer(json.get());
    return;
  }

  if (cnt < 10000) {
    cnt = 0;
    heartbeat();
    Serial.println("send");
  } else {
    cnt++;
  }
}
