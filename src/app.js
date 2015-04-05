var UI = require('ui');
var ajax = require('ajax');
var Vector2 = require('vector2');
var Vibe = require('ui/vibe');

var parseFeed = function(data, quantity) {
  var items = [];
  for(var i = 0; i < quantity; i++) {
    var mag = 'Mag: ' + data.features[i].properties.mag;

    // Get date/time substring
    var time = new Date(data.features[i].properties.time);
    var overview = time.getHours() + ':' + time.getMinutes() + ', ' + time.getDate() + '/' + time.getMonth();
    // Add to menu items array
    items.push({
      title:mag,
      subtitle:overview
    });
  }

  // Finally return whole array
  return items;
};

// Show splash screen while waiting for data
var splashWindow = new UI.Window({
  backgroundColor: 'white'
});

// Text element to inform user
var text = new UI.Text({
  position: new Vector2(0, 50),
  size: new Vector2(144, 168),
  text:'Earthquake!!',
  font:'GOTHIC_28_BOLD',
  color:'white',
  textOverflow:'wrap',
  textAlign:'center',
  backgroundColor:'clear'
});

var circle = new UI.Circle({
  position: new Vector2(72, 84),
  radius: 25,
  backgroundColor: 'black'
});

// Add to splashWindow and show
splashWindow.add(circle);
splashWindow.add(text);
splashWindow.show();

circle.prop({ radius: 50 });
// var radius = circle.radius(50);
// circle.animate('radius', radius, 600);

// Make request to USGS
var d = new Date();
d.setHours(d.getHours()-6);
var past6Hours = d.toISOString();
var query = 'http://earthquake.usgs.gov/fdsnws/event/1/query?'+
    'format=geojson'+
    '&starttime='+past6Hours+
    '&minlatitude=30&minlongitude=-130'+
    '&maxlatitude=45&maxlongitude=-112'+
    '&limit=6'+
    '&orderby=time';

// Get user's location
var locationOptions = {
  enableHighAccuracy: true, 
  maximumAge: 10000, 
  timeout: 10000
};
var userLat;
var userLon;

function locationSuccess(pos) {
  console.log('lat= ' + pos.coords.latitude + ' lon= ' + pos.coords.longitude);
  userLat = pos.coords.latitude;
  userLon = pos.coords.longitude;
}

function locationError(err) {
  console.log('location error (' + err.code + '): ' + err.message);
}

// Make an asynchronous request
navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);

// Calculate distance
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
  ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d/1.609;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

function init() {
  ajax(
    {
      url: query,
      type:'json'
    },
    function(data) {
      // Create an array of Menu items
      var menuItems = parseFeed(data, 6);
  
      // Construct Menu to show to user
      var resultsMenu = new UI.Menu({
        sections: [{
          title: 'Recent Earthquakes',
          items: menuItems,
        }]
      });
  
      // Add an action for SELECT
      resultsMenu.on('select', function(e) {
        // Get that forecast
        var properties = data.features[e.itemIndex].properties;
        var eqLat = data.features[e.itemIndex].geometry.coordinates[1];
        var eqLon = data.features[e.itemIndex].geometry.coordinates[0];
        // Assemble body string
        var content = properties.place + ', ' + Math.round(getDistanceFromLatLonInKm(userLat,userLon,eqLat,eqLon)) + ' Mi away';
  
        // Add temperature, pressure etc
        content += '\nLatitude: ' + eqLat.toFixed(2) + '°N' +
          '\nLongtitude: ' + (- eqLon).toFixed(2) + '°W' +
          '\nDepth: ' + (data.features[e.itemIndex].geometry.coordinates[2]).toFixed(2) + 'KM';
  
        // Create the Card for detailed view
        var detailCard = new UI.Card({
          title:e.item.title,
          subtitle:e.item.subtitle,
          body: content,
          style: "small",
          scrollable :true
        });
  
        detailCard.show();
      });
  
      // Show the Menu, hide the splash
      resultsMenu.show();
      splashWindow.hide();
  
      // Register for setinterval
      var cycle = function() {
        // Make another request to 
        ajax(
          {
            url: query,
            type:'json'
          },
          // success
          function(data)  {
            var newItems = parseFeed(data, 6);
            if (newItems[0].subtitle != menuItems[0].subtitle) {
              // Update the Menu's first section
              resultsMenu.items(0, newItems);
              Vibe.vibrate('short');
            }
            else{
              console.log('5 min');
            }
          },
          // failure      
          function(error) {
            console.log('Download failed: ' + error);
          }
        );
      };
      cycle();
      setInterval(cycle, 5 * 60 * 1000);
  
    },
    function(error) {
      console.log("Download failed: " + error);
    }
  );
}

setTimeout(init, 1000);
