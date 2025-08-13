async function getPigData(pigId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT pig_id, pig_name, device_code FROM pig_meta_data WHERE pig_id = '${pigId}'`;

      db.query(query, (error, results) => {
        if (error) reject(error);
        else {
          resolve(results[0]); // Assuming pig_id is unique, retrieve the first row
        }
      });
    });
  }
  async function getLastCoughEvent(pigId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT date_time FROM cough_events WHERE pig_id = '${pigId}' ORDER BY date_time DESC LIMIT 1`;

      db.query(query, (error, results) => {
        if (error) reject(error);
        else {
          if (results.length > 0) {
            const lastCoughEvent = {
              date_time: moment(results[0].date_time).format('ddd MMM DD YYYY (h:mm A)')
            };
            resolve(lastCoughEvent);
          } else {
            resolve(null);
          }
        }
      });
    });
  }

  async function getCounts(pigId) {
    // Define the date ranges you want to count entries for
    const today = moment().startOf('day');
    const thisWeek = moment().startOf('week');
    const thisMonth = moment().startOf('month');
    const thisYear = moment().startOf('year');

    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM cough_events WHERE pig_id = '${pigId}' ORDER BY date_time DESC`;

      db.query(query, (error, results) => {
        if (error) reject(error);
        else {
          const counts = {
            today: { coughs: 0 },
            thisWeek: { coughs: 0 },
            thisMonth: { coughs: 0 }, 
            thisYear: { coughs: 0 },
            coughEvents: []
          };

          // Loop through each cough event and increment the appropriate count
          results.forEach(event => {
            const dateTime = moment(event.date_time);

            if (dateTime.isSame(today, 'day')) counts.today.coughs++;
            if (dateTime.isSameOrAfter(thisWeek)) counts.thisWeek.coughs++;
            if (dateTime.isSameOrAfter(thisMonth)) counts.thisMonth.coughs++;
            if (dateTime.isSameOrAfter(thisYear)) counts.thisYear.coughs++;

            event.date = dateTime.format('MMM DD, YYYY');
            event.time = dateTime.format('h:mm A');
            event.week = dateTime.format('ddd');

            counts.coughEvents.push({
              cough_id: event.cough_id,
              duration: event.duration,
              accuracy: event.accuracy,
              week: event.week,
              date: event.date,
              time: event.time
            });
          });

          resolve(counts);
        }
      });
    });
  }

  function formatCounts(counts) {
    const formattedCounts = {
      today: {
        coughs: counts.today.coughs
      },
      thisWeek: {
        coughs: counts.thisWeek.coughs
      },
      thisMonth: {
        coughs: counts.thisMonth.coughs
      },
      thisYear: {
        coughs: counts.thisYear.coughs
      },
      coughEvents: counts.coughEvents
    };

    return formattedCounts;
  }
async function getDevices() {
      return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM devices';
    
        db.query(query, (error, results) => {
          if (error) reject(error);
          else resolve(results);
        });
      });
    }

let serverFormattedCounts = [];
let serverLastCoughEvent = [];
let serverCounts = [];
let serverPigData = [];   
let serverDevices = []; 

    io.on('connection', (socket) => {
    const pigId = socket.handshake.query.pigId;
    socket.emit('oldData', serverFormattedCounts, serverLastCoughEvent, serverCounts, serverPigData, serverDevices);
            // Emit the updated data whenever it changes
            const emitInitialData = async () => {
              const devices = await getDevices();
              const pigData = await getPigData(pigId);
              const counts = await getCounts(pigId);
              const formattedCounts = formatCounts(counts);
              const lastCoughEvent = await getLastCoughEvent(pigId);
              socket.emit('oldData',formattedCounts, lastCoughEvent, counts, pigData, devices);
              
            };
            const updateCountsAndEmit = async () => {
              const devices = await getDevices();
              const pigData = await getPigData(pigId);
              const counts = await getCounts(pigId);
              const formattedCounts = formatCounts(counts);
              const lastCoughEvent = await getLastCoughEvent(pigId);
              if (hasDataChanged(formattedCounts, lastCoughEvent, counts, pigData, devices)) {
                serverFormattedCounts = formattedCounts;
                serverLastCoughEvent = lastCoughEvent;
                serverCounts = counts;
                serverPigData = pigData;
                serverDevices = devices;
                socket.emit('newData', formattedCounts, lastCoughEvent, counts, pigData, devices);
              }
            };
            emitInitialData();
           // Define the interval duration in milliseconds (e.g., every 10 seconds)
          const intervalDuration = 1000;
          // Set up the interval to execute the query and update the counts
          const interval = setInterval(() => {
            // Call the function to update the counts and emit the updated data to the clients
            updateCountsAndEmit();
          }, intervalDuration);
          // Stop the interval when the client disconnects
          socket.on('disconnect', () => {
            clearInterval(interval);
          });
        });
        function hasDataChanged(newFormattedCounts, newLastCoughEvent, newCounts, newPigData, newDevices) {
          // Compare the new data with the stored data on the server side
          const isFormattedCountsChanged = JSON.stringify(newFormattedCounts) !== JSON.stringify(serverFormattedCounts);
          const isLastCoughEventChanged = JSON.stringify(newLastCoughEvent) !== JSON.stringify(serverLastCoughEvent);
          const isCountsChanged = JSON.stringify(newCounts) !== JSON.stringify(serverCounts);
          const isPigDataChanged = JSON.stringify(newPigData) !== JSON.stringify(serverPigData);
          const isDevicesChanged = JSON.stringify(newDevices) !== JSON.stringify(serverDevices);
          // Return true if any of the data has changed
          return isFormattedCountsChanged || isLastCoughEventChanged || isCountsChanged || isPigDataChanged || isDevicesChanged;
        }
        app.get('/individualPig/:pigId', checkAuthenticated, async (req, res) => {
        const pigId = req.params.pigId;

        const devices = await getDevices();
        const pigData = await getPigData(pigId);
        const counts = await getCounts(pigId);
        const lastCoughEvent = await getLastCoughEvent(pigId);

        // Retrieve the current page number from the query parameter
        const page = parseInt(req.query.page) || 1;

        // Define the number of cough events to display per page
        const PAGE_SIZE = 10;

        // Calculate the start and end indices for the current page
        const startIndex = (page - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;

        const formattedCounts = formatCounts(counts);
        const coughEvents = formattedCounts.coughEvents.slice(startIndex, endIndex);

        ejs.renderFile('views/pages/individualPig.ejs', { formattedCounts, pigData, lastCoughEvent, coughEvents, currentPage: page, PAGE_SIZE, pigId: pigId, fullName: req.user.fullName, devices: devices }, (err, html) => {
            if (err) {
            console.log(err);
            res.status(500).send('Internal server error');
            } else {
            res.send(html);
            }
        });
        }); 