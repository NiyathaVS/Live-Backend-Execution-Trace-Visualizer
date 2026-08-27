package com.example.tracer.controller;


/**
 * HTTP Request
   ↓
UserController.getUser()
   ↓
UserService.getUser()
   ↓
UserRepository.findUserById()
 */

import com.example.tracer.service.UserService;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

@RestController
@RequestMapping("/users")
public class UserController {

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public String getUser(@PathVariable Long id) {

        logger.info("Handling request with requestId={}", MDC.get("requestId"));

        simulateControllerWork();

        return userService.getUser(id);
    }

    private void simulateControllerWork() {
        try {
            Thread.sleep(30);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
