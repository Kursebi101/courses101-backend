const { User } = require("../models/user");
const { RefreshToken } = require("../models/refreshToken");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();

const {
  generateAccessToken,
  generateRefreshToken,
  verify,
} = require("../middleware/auth");

router.post("/signin", async (req, res) => {
  const body = req.body;

  let existingUser = await User.findOne({ email: body.email });
  let existingRT = await RefreshToken.findOne({ userID: existingUser._id });

  if (!existingUser)
    return res.status(404).send({ code: 'user/not_found', message: 'მომხმარებელი ვერ მოიძებნა' });

  let passwordIsValid = await bcrypt.compare(
    body.password,
    existingUser.password
  );

  if (!passwordIsValid) return res.status(401).send({ code: 'user/incorrect_password', message: 'არასწორი პაროლი' });

  let generatedAccessToken = generateAccessToken(existingUser);
  let generatedRefreshToken = generateRefreshToken(existingUser);

  try {
    if (existingRT) {
      RefreshToken.findOneAndDelete(
        {
          userID: existingUser._id,
        },
        function (err, docs) {
          if (err) {
            console.log(err, "[DELETE ERROR]");
          }
        }
      );
    }
  } catch (err) {
    return console.log(err, "[REFRESH TOKEN ERROR]");
  }

  let refreshToken = new RefreshToken();
  refreshToken.userID = existingUser._id;
  refreshToken.refreshToken = generatedRefreshToken;
  await refreshToken.save().catch((err) => {
    return console.log("[SOMETHING WITH SAVING RT]", err);
  });

  return res
    .cookie("refresh_token", generatedRefreshToken, {
      httpOnly: true,
      secure: false,
    })
    .status(200)
    .send({
      uid: existingUser._id,
      token: `Bearer ${generatedAccessToken}`,
      code: 'user/signed_id',
      message: "მონაცემები დადასტურებულია",
      data: existingUser
    });
});

router.post("/signup", async (req, res) => {
  const body = req.body;

  let existingUser = await User.findOne({ email: body.email });
  if (existingUser) return res.status(200).send({ code: 'user/already_registered', message: 'User is Already Registered' });

  const user = new User(body);

  const salt = await bcrypt.genSalt(15);
  user.password = await bcrypt.hash(user.password, salt);

  return user
    .save()
    .then(async (createdUser) => {

      let generatedAccessToken = generateAccessToken(createdUser);
      let generatedRefreshToken = generateRefreshToken(createdUser);

      let refreshToken = new RefreshToken();
      refreshToken.userID = createdUser._id;
      refreshToken.refreshToken = generatedRefreshToken;
      await refreshToken.save().catch((err) => {
        return console.log("[SOMETHING WITH SAVING RT]", err);
      });

      res
        .cookie("refresh_token", generatedRefreshToken, {
          httpOnly: true,
          secure: false,
        })
        .status(201)
        .send({
          uid: createdUser._id,
          token: `Bearer ${generatedAccessToken}`,
          message: "User Created Successfully",
        })
    }
    )
    .catch((err) => console.log(err, "[MONGO DB ERROR]"));
});

// router.get("/is_admin", verify, async (req, res) => {
//   try {
//     let existingUser = await User.findOne({ _id: req.user._id });

//     if (!existingUser.isAdmin) {
//       res.status(403).send("Access Restricted");
//     } else {
//       res.status(200).send("Access Granted");
//     }
//   } catch (err) {
//     console.log("Something went wrong: ", err);
//   }
// });

module.exports = router;
