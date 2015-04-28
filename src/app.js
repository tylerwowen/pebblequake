// Tyler Weimin Ouyang
// ouyang@cs.ucsb.edu
//
//
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
    var overview = time.getHours() + ':' + time.getMinutes() + ', ' + time.getDate() + '/' + (time.getMonth()+1);
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
  backgroundColor: 'clear'
});

var logo_image = new UI.Image({
  position: new Vector2(0, 0),
  size: new Vector2(144, 144),
  backgroundColor: 'clear',
  image:'images/big_icon.png'
});

// Add to splashWindow and show
splashWindow.add(logo_image);
splashWindow.show();

// Make request to USGS
var d = new Date();
d.setDate(d.getDate()-2);
var past48Hours = d.toISOString();
var query = 'http://earthquake.usgs.gov/fdsnws/event/1/query?'+
    'format=geojson'+
    '&starttime='+past48Hours+
    '&minlatitude=25&minlongitude=80'+
    '&maxlatitude=31&maxlongitude=90'+
    '&limit=12'+
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
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

ajax(
  {
    url: query,
    type:'json'
  },
  function(data) {
    // Create an array of Menu items
    var menuItems = parseFeed(data, 12);

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
      var content = properties.place + ', ' + Math.round(getDistanceFromLatLonInKm(userLat,userLon,eqLat,eqLon)) + ' KM away';

      // Add temperature, pressure etc
      content += '\nLatitude: ' + eqLat.toFixed(2) + '°N' +
        '\nLongtitude: ' + eqLon.toFixed(2) + '°E' +
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
          var newItems = parseFeed(data, 12);
          if (newItems[0].subtitle != menuItems[0].subtitle) {
            // Update the Menu's first section
            splashWindow.hide();
            resultsMenu.items(0, newItems);
            resultsMenu.show();
            Vibe.vibrate('double');
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

    resultsMenu.on('longSelect', function(e){
      splashWindow.show();
      ajax(
        {
          url: query,
          type:'json'
        },
        // success
        function(data)  {
          var newItems = parseFeed(data, 12);
          if (newItems[0].subtitle != menuItems[0].subtitle) {
            // Update the Menu's first section
            splashWindow.hide();
            resultsMenu.items(0, newItems);
            resultsMenu.show();
            Vibe.vibrate('double');
          }
          else{
            console.log('no updates');
            resultsMenu.show();
            splashWindow.hide();
          }
        },
        // failure      
        function(error) {
          console.log('Download failed: ' + error);
        }
      );
    });

  },
  function(error) {
    console.log("Download failed: " + error);
  }
);
