// AuthController.ts
import express, { Request, Response, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User } from "../database";
import { ApiError, encryptPassword, isPasswordMatch } from "../utils";
import config from "../config/config";
import { IUser } from "../database";

const jwtSecret = config.JWT_SECRET as string;
const COOKIE_EXPIRATION_DAYS = 90;
const expirationDate = new Date(
  Date.now() + COOKIE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
);
const cookieOptions: express.CookieOptions = {
  expires: expirationDate,
  secure: false,
  httpOnly: true,
};

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

const register: RequestHandler = async (
  req: Request<{}, any, RegisterRequest>,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new ApiError(400, "User already exists!");
    }

    const user = await User.create({
      name,
      email,
      password: await encryptPassword(password),
    });

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    res.status(200).json({
      status: 200,
      message: "User registered successfully!",
      data: userData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({
      status: 500,
      message,
    });
  }
};

const createSendToken = async (user: IUser, res: Response): Promise<string> => {
  const { name, email, _id: id } = user;
  const token = jwt.sign({ name, email, id }, jwtSecret, {
    expiresIn: "1d",
  });

  if (config.env === "production") {
    cookieOptions.secure = true;
  }
  res.cookie("jwt", token, cookieOptions);

  return token;
};

const login: RequestHandler = async (
  req: Request<{}, any, LoginRequest>,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await isPasswordMatch(password, user.password as string))) {
      throw new ApiError(400, "Incorrect email or password");
    }

    const token = await createSendToken(user, res);

    res.status(200).json({
      status: 200,
      message: "User logged in successfully!",
      token,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({
      status: 500,
      message,
    });
  }
};

export default {
  register,
  login,
};
