if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
  const express = require('express');
  const mysql = require('mysql');
  const moment = require('moment');
  const path = require('path');
  const ejs = require('ejs');
  const bcrypt = require('bcrypt');
  const passport = require('passport');
  const flash = require('express-flash');
  const session = require('express-session');
  const methodOverride = require('method-override');
  const initializePassport = require('./passport-config.js');
  const app = express();
  
  const http = require('http').createServer(app);
  const io = require('socket.io')(http);
  const port = 3000;
  
  // Initialize Passport
  initializePassport(passport, getUserByEmail, getUserById);
  
  // Function to get user by email
  function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE email = ?`;
      db.query(query, [email], (error, results) => {
        if (error) reject(error);
        else resolve(results[0]);
      });
    });
  }
  
  // Function to get user by user_id
  function getUserById(user_id) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE user_id = ?`;
      db.query(query, [user_id], (error, results) => {
        if (error) reject(error);
        else resolve(results[0]);
      });
    });
  }
  
  app.set('view engine', 'ejs');
  app.use(flash());
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(methodOverride('_method'));
  // Create connection to MySQL database
  const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'piggyweariot',
  });
  // Connect to MySQL database
  db.connect((err) => {
    if (err) {
      throw err;
    }
    console.log('Connected to MySQL database');
  });
    app.use(express.urlencoded({ extended: false }));
    app.use(express.static(path.join(__dirname, 'public')));
    
    //pigs.ejs 
    async function getCoughingResults(todayStart, todayEnd) {
        return new Promise((resolve, reject) => {
          const query = `
          SELECT pig_meta_data.pig_id, pig_meta_data.pig_name, pig_meta_data.device_code, MAX(cough_events.date_time) AS latest_cough
          FROM pig_meta_data 
          LEFT JOIN cough_events ON pig_meta_data.pig_id = cough_events.pig_id 
          WHERE cough_events.date_time >= '${todayStart}' AND cough_events.date_time <= '${todayEnd}'
          GROUP BY pig_meta_data.pig_id, pig_meta_data.pig_name, pig_meta_data.device_code
          ORDER BY latest_cough DESC
        `;
      
        db.query(query, (error, results) => {
          if (error) reject(error);
          else {
            // Format the date and time using moment.js
            results.forEach((result) => {
              result.latest_cough = moment(result.latest_cough).format('ddd MMM DD YYYY (h:mm A)');
            });
            resolve(results);
          }
          });
        });
      }
      async function getNoncoughingResults(todayStart, todayEnd) {
        return new Promise((resolve, reject) => {
          const query = `
          SELECT pig_meta_data.pig_id, pig_meta_data.pig_name, pig_meta_data.device_code, MAX(cough_events.date_time) AS last_event
          FROM pig_meta_data
          LEFT JOIN cough_events ON pig_meta_data.pig_id = cough_events.pig_id
          WHERE pig_meta_data.pig_id NOT IN (
            SELECT DISTINCT cough_events.pig_id
            FROM cough_events
            WHERE cough_events.date_time >= '${todayStart}' AND cough_events.date_time <= '${todayEnd}'
          )
          GROUP BY pig_meta_data.pig_id, pig_meta_data.pig_name, pig_meta_data.device_code
          ORDER BY last_event DESC
          `;
      
          db.query(query, (error, results) => {
            if (error) reject(error);
            else {
              results.forEach((result) => {
                if (!result.last_event || isNaN(Date.parse(result.last_event))) {
                  result.last_event = 'No cough events';
                } else {
                  result.last_event = moment(result.last_event).format('ddd MMM DD YYYY (h:mm A)');
                }
              });
              resolve(results);
            }
          });
        });
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
      
      async function getDevicesWithPigs() {
        return new Promise((resolve, reject) => {
          const query = `SELECT pig_name, device_code FROM pig_meta_data`;
  
          db.query(query, (error, results) => {
            if (error) reject(error);
            else resolve(results);
          });
        });
      }
    
    async function renderPigsPage(req, res) {
        const todayStart = moment().startOf('day').format('YYYY-MM-DD');
        const todayEnd = moment().endOf('day').add(24, 'hours').format('YYYY-MM-DD');
      
        const coughingData = await getCoughingResults(todayStart, todayEnd);
        const nonCoughingData = await getNoncoughingResults(todayStart, todayEnd);
        const devices = await getDevices();
      
        ejs.renderFile('views/pages/Pigs.ejs', {
          coughingData,
          nonCoughingData,
          fullName: req.user.fullName,
          devices,
        }, (err, html) => {
          if (err) {
            console.log(err);
            res.status(500).send('Internal server error');
          } else {
            res.send(html);
          }
        });
      }
        
      io.on('connection', (socket) => {
        const pigId = socket.handshake.query.pigId;
        let serverCoughingData = [];
        let serverNonCoughingData = [];
        let serverFormattedCounts = [];
        let serverLastCoughEvent = [];
        let serverCounts = [];
        let serverDevices = [];
        let serverDWP = [];
      
        const emitInitialData = async () => {
          const todayStart = moment().startOf('day').format('YYYY-MM-DD');
          const todayEnd = moment().endOf('day').add(24, 'hours').format('YYYY-MM-DD');
          const coughingData = await getCoughingResults(todayStart, todayEnd);
          const nonCoughingData = await getNoncoughingResults(todayStart, todayEnd);
          const counts = await getCounts(pigId);
          const formattedCounts = formatCounts(counts);
          const lastCoughEvent = await getLastCoughEvent(pigId);
          const devices = await getDevices();
          const devicesWithPigs = await getDevicesWithPigs(devices);

          socket.emit('initialData', coughingData, nonCoughingData);
          socket.emit('oldData', formattedCounts, lastCoughEvent);
          socket.emit('datasent', devices, devicesWithPigs);
        };
      
        const updateCountsAndEmit = async () => {
          const todayStart = moment().startOf('day').format('YYYY-MM-DD');
          const todayEnd = moment().endOf('day').add(24, 'hours').format('YYYY-MM-DD');
          const coughingData = await getCoughingResults(todayStart, todayEnd);
          const nonCoughingData = await getNoncoughingResults(todayStart, todayEnd);
          const counts = await getCounts(pigId);
          const formattedCounts = formatCounts(counts);
          const lastCoughEvent = await getLastCoughEvent(pigId);
          const devices = await getDevices();
          const devicesWithPigs = await getDevicesWithPigs(devices);

          if (hasDataChanged(coughingData, nonCoughingData, formattedCounts, lastCoughEvent, devices, devicesWithPigs)) {
            serverCoughingData = coughingData;
            serverNonCoughingData = nonCoughingData;
            serverFormattedCounts = formattedCounts;
            serverLastCoughEvent = lastCoughEvent;
            serverCounts = counts;
            serverDevices = devices;
            serverDWP = devicesWithPigs;  
               
            socket.emit('updateCounts', coughingData, nonCoughingData);
            socket.emit('newData', formattedCounts, lastCoughEvent);
            socket.emit('updateddata', devices, devicesWithPigs);
          }
        };
      
        emitInitialData();
        // Helper function to check if data has changed
        function hasDataChanged(newCoughingData, newNonCoughingData, newFormattedCounts, newLastCoughEvent, newCounts, newDevices, newDWP) {
        const isCoughingDataChanged = JSON.stringify(newCoughingData) !== JSON.stringify(serverCoughingData);
        const isNonCoughingDataChanged = JSON.stringify(newNonCoughingData) !== JSON.stringify(serverNonCoughingData);
        const isFormattedCountsChanged = JSON.stringify(newFormattedCounts) !== JSON.stringify(serverFormattedCounts);
        const isLastCoughEventChanged = JSON.stringify(newLastCoughEvent) !== JSON.stringify(serverLastCoughEvent);
        const isCountsChanged = JSON.stringify(newCounts) !== JSON.stringify(serverCounts);
        const isDevicesChanged = JSON.stringify(newDevices) !== JSON.stringify(serverDevices);
        const isDWPChanged = JSON.stringify(newDWP) !== JSON.stringify(serverDWP);      
        // Return true if either coughingData or nonCoughingData has changed
        return isCoughingDataChanged || isNonCoughingDataChanged || isFormattedCountsChanged || isLastCoughEventChanged || isCountsChanged || isDevicesChanged || isDWPChanged;;
        }

        const intervalDuration = 1000;
      
        // Set up the interval to execute the query and update the counts
        const interval = setInterval(() => {
          updateCountsAndEmit();
        }, intervalDuration);
      
        // Stop the interval when the client disconnects
        socket.on('disconnect', () => {
          clearInterval(interval);
        });
      });

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

    app.get('/pigs', checkAuthenticated, async (req, res) => {
        renderPigsPage(req, res);
        });
       
  app.post('/submit', (req, res) => {
    const { name, device } = req.body;
  
    // Check if the device is already associated with a profile
    const checkDeviceQuery = 'SELECT * FROM pig_meta_data WHERE device_code = ?';
    db.query(checkDeviceQuery, [device], (checkDeviceError, checkDeviceResults) => {
      if (checkDeviceError) {
        console.error('Error checking device:', checkDeviceError);
        res.sendStatus(500);
      } else if (checkDeviceResults.length > 0) {
        // Device is already associated with a profile, display an error message
        const errorMessage = 'Device is already associated with a profile';
        console.log(errorMessage);
        // Display the error message in a pop-up
        res.send(`<script>alert('${errorMessage}'); window.location.href='/pigs';</script>`);
      } else {
        // Device is not associated with any profile, insert the new profile
        const insertQuery = 'INSERT INTO pig_meta_data (pig_name, device_code) VALUES (?, ?)';
        db.query(insertQuery, [name, device], (insertError) => {
          if (insertError) {
            console.error('Error registering profile:', insertError);
            res.sendStatus(500);
          } else {
            console.log('Profile registered successfully');
            const successMessage = 'Profile registered successfully';
            console.log(successMessage);
            // Display the success message in a pop-up
            res.send(`<script>alert('${successMessage}'); window.location.href='/pigs';</script>`);
          }
        });
      }
    });
  });
  
      app.get('/login', checkNotAuthenticated, (req, res)=>{
        res.render('pages/login')
      })
      app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
        successRedirect: '/pigs',
        failureRedirect: '/login',
        failureFlash: true
      }))
  
      app.get('/register', checkNotAuthenticated, (req, res)=>{
        res.render('pages/register')
      });
  
      app.post('/register', checkNotAuthenticated, async (req, res) => {
          const fullName = req.body.fullName;
          const email = req.body.email;
          const hashedPassword = await bcrypt.hash(req.body.password, 10);
      
          const sql = `INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)`;
          db.query(sql, [fullName, email, hashedPassword], (err, result) => {
            if (err) {
              console.error('Error inserting data into MySQL: ', err);
              res.sendStatus(500);
            } else {
              console.log('Registered Successfully');
              res.redirect('/login');
            }
          });
      });
      app.delete('/logout', (req, res, next) => {
        req.logOut((err) => {
          if (err) {
            return next(err);
          }
          res.redirect('/login');
        });
      });
  
      function checkAuthenticated(req, res, next){
        if(req.isAuthenticated()){
          return next()
        }
        res.redirect('/login')
      }
      function checkNotAuthenticated(req,res, next){
        if(req.isAuthenticated()){
          return res.redirect('/pigs')
        }
        next()
      }

      // Server code
      app.post('/delete/:pigId', checkAuthenticated, (req, res) => {
        const pigId = req.params.pigId;
        
        const deletePigQuery = 'DELETE FROM pig_meta_data WHERE pig_id = ?';
        const deleteCoughEventsQuery = 'DELETE FROM cough_events WHERE pig_id = ?';
      
        db.query(deleteCoughEventsQuery, [pigId], (error) => {
          if (error) {
            console.error('Error deleting cough events:', error);
            req.flash('error', 'Failed to delete the cough events');
            res.redirect('/pigs');
          } else {
            console.log('Cough events deleted successfully');
            // Once the cough events are deleted, proceed to delete the pig_meta_data row
            db.query(deletePigQuery, [pigId], (error) => {
              if (error) {
                console.error('Error deleting pig_meta_data row:', error);
                req.flash('error', 'Failed to delete the profile');
                res.redirect('/pigs');
              } else {
                console.log('Row deleted successfully');
                req.flash('success', 'Profile and related cough events deleted successfully');
                res.redirect('/pigs');
              }
            });
          }
        });
      });
      app.get('/devices', checkAuthenticated, async (req, res) => {
        
        const devices = await getDevices();
        const devicesWithPigs = await getDevicesWithPigs(devices);
      
        ejs.renderFile('views/pages/device.ejs', { devicesWithPigs, devices, fullName: req.user.fullName }, (err, html) => {
          if (err) {
            console.log(err);
            res.status(500).send('Internal server error');
          } else {
            res.send(html);
          }
        });
      });
      // POST route for deleting a device
      app.post('/devices/delete/:id', checkAuthenticated, (req, res) => {
        const deviceId = req.params.id;
        const deleteQuery = 'DELETE FROM devices WHERE id = ?';
        db.query(deleteQuery, [deviceId], (deleteError) => {
          if (deleteError) {
            console.error('Error deleting device:', deleteError);
            res.sendStatus(500);
          } else {
            console.log('Device deleted successfully');
            const successMessage = 'Device deleted successfully';
            res.send(`<script>alert('${successMessage}'); window.location.href='/devices';</script>`);
          }
        });
      });
      http.listen(port, () => {
        console.log(`Server is running on port http://localhost:${port}/login`);
      });
      