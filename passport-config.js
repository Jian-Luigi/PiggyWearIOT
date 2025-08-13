const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = async (email, password, done) => {
    const user = await getUserByEmail(email);
    if (user == null) {
      return done(null, false, { message: 'Wrong Credentials. Please Try Again.' });
    }
    try {
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Wrong Credentials. Please Try Again.' });
      }
    } catch (e) {
      return done(e);
    }
  };

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, authenticateUser)
  );
  
  passport.serializeUser((user, done) => {
    done(null, user.user_id); // Serialize using user_id
  });

  passport.deserializeUser(async (id, done) => {
    const user = await getUserById(id); // Deserialize using user_id
    done(null, user);
  });
}

module.exports = initialize;
