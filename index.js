var request = require("request");
var Service, Characteristic;
var exec = require('child_process').exec;
var net = require('net');
var inherits = require('util').inherits;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
    
  fixInheritance(HarmanKardonAVRAccessory.Input, Characteristic);
  fixInheritance(HarmanKardonAVRAccessory.Mute, Characteristic);
  fixInheritance(HarmanKardonAVRAccessory.AudioService, Service);    

  homebridge.registerAccessory("homebridge-harman-kardon-avr", "harman-kardon-avr", HarmanKardonAVRAccessory);
};

function fixInheritance(subclass, superclass) {
    var proto = subclass.prototype;
    inherits(subclass, superclass);
    subclass.prototype.parent = superclass.prototype;
    for (var mn in proto) {
        subclass.prototype[mn] = proto[mn];
    }
};

function buildRequest(cmd,para) {
   var text = '';
   var payload = '<?xml version="1.0" encoding="UTF-8"?> <harman> <avr> <common> <control> <name>'+cmd+'</name> <zone>Main Zone</zone> <para>'+para+'</para> </control> </common> </avr> </harman>';
   text += 'POST HK_APP HTTP/1.1\r\n';
   text += 'Host: :' + this.ip + '\r\n';
   text += 'User-Agent: Harman Kardon AVR Controller/1.0\r\n';
   text += 'Content-Length: ' + payload.length + '\r\n';
   text += '\r\n';
   text += payload;
   //console.log(text);
   return text;
};

function HarmanKardonAVRAccessory(log, config) {
  this.log          = log;
  this.name         = config["name"];
  this.ip           = config["ip"];
  this.port         = config["port"];    
  this.model_name   = config["model_name"] || "AVR 161";
  this.manufacturer = config["manufacturer"] || "Harman Kardon";    
};

//custom characteristics
HarmanKardonAVRAccessory.Input = function () {
    Characteristic.call(this, 'Input', '00001001-0000-1000-8000-135D67EC4377');
    this.setProps({
        format: Characteristic.Formats.UINT8,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};


HarmanKardonAVRAccessory.Mute = function () {
    Characteristic.call(this, 'Mute', '6b5e0bed-fdbe-40b6-84e1-12ca1562babd');
    this.setProps({
    format: Characteristic.Formats.INT,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
    this.value = this.getDefaultValue();
};


HarmanKardonAVRAccessory.AudioService = function (displayName, subtype) {
    Service.call(this, displayName, '48a7057e-cb08-407f-bf03-6317700b3085', subtype);
    this.addCharacteristic(HarmanKardonAVRAccessory.Input);
    this.addOptionalCharacteristic(HarmanKardonAVRAccessory.Mute);
};


HarmanKardonAVRAccessory.prototype = {
    
  setPowerState: function(powerOn, callback) {
    var that        = this;
    var command     = powerOn ? that.on_command : that.off_command;
    if (powerOn) {
        var client = new net.Socket();
        client.connect(this.port, this.ip, function() {
        client.write(buildRequest('power-on'));
        client.destroy();   
        });
    } else {
        var client = new net.Socket();
        client.connect(this.port, this.ip, function() {
        client.write(buildRequest('power-off'));
        client.destroy();   
        });
    }
      
    callback()
  },
      
  getPowerState: function(callback) {
    var that        = this;
    var state       = false;   

    exec("ping -c 2 -W 1 " +this.ip+ " | grep -i '2 received'", function(error, stdout, stderr) {
        state = stdout ? true : false;
        that.log("Current state: " + (state ? "On." : "Off."));
        callback(null, state);
    });
  },
    
  setMute: function(state, callback) {
    var that        = this;
    this.log("Set Mute:" + state);
    var client = new net.Socket();
    client.connect(this.port, this.ip, function() {
    client.write(buildRequest('mute-on'));
    client.destroy();
        callback(null);
    });
  },    
    
  identify: function(callback) {
      this.log('Identify requested!');
      callback(); // success
    },    
    
  getServices: function() {
      
    var availableServices = [];  
    var informationService = new Service.AccessoryInformation();
    
    availableServices.push(informationService);
      
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model_name)
     //.setCharacteristic(Characteristic.SerialNumber, this.model_name);
           
      var switchService = new Service.Switch(this.name);
      availableServices.push(switchService);    

    switchService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setPowerState.bind(this))
      .on('get', this.getPowerState.bind(this));
      
      var audioService = new HarmanKardonAVRAccessory.AudioService('Audio Service');
    availableServices.push(audioService);
      audioService.getCharacteristic(HarmanKardonAVRAccessory.Mute)
      .on('set', this.setMute.bind(this));

      
      return availableServices;
  }
}
